/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  issueSessionToken,
  verifySessionToken,
  revokeSessionToken,
  isSessionTokenRevoked,
  signCredential,
  verifyCredentialSignature,
  issueOtp,
  consumeOtp,
  rateLimit,
  SESSION_TTL_MS,
} from './security.ts';

before(() => {
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef0123456789';
  process.env.CREDENTIAL_SIGNING_SECRET = 'test-credential-secret-0123456789abcdef012345';
});

const credential = {
  id: 'CRED-TEST-1',
  title: 'B.E. Civil Engineering',
  issuingInstitution: 'Sample College',
  yearOfPassing: 2025,
  cgpaOrPercentage: '8.4 CGPA',
  aicteApprovalNumber: 'AICTE-TEST-1',
};

describe('Passwords', () => {
  it('hashes with a random salt and verifies only the right password', () => {
    const a = hashPassword('Passw0rd99');
    const b = hashPassword('Passw0rd99');
    assert.notEqual(a, b, 'same password must give different hashes (salted)');
    assert.equal(verifyPassword('Passw0rd99', a), true);
    assert.equal(verifyPassword('wrong-pass1', a), false);
    assert.equal(verifyPassword('anything', null), false, 'accounts without a password cannot sign in');
  });

  it('rejects weak passwords such as the old demo PIN', () => {
    assert.ok(validatePasswordStrength('2026'));
    assert.ok(validatePasswordStrength('apaar2026x') === null);
    assert.ok(validatePasswordStrength('onlyletters'));
  });
});

describe('Session tokens', () => {
  it('round-trips a user ID and carries no role', () => {
    const token = issueSessionToken('user-abc');
    assert.deepEqual(verifySessionToken(token), { uid: 'user-abc' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    assert.equal(payload.role, undefined);
  });

  it('rejects expired, altered and forged tokens', () => {
    const now = Date.now();
    const token = issueSessionToken('user-abc', now);
    assert.equal(verifySessionToken(token, now + SESSION_TTL_MS + 1), null, 'expired');

    const [p, body, sig] = token.split('.');
    const altered = Buffer.from(JSON.stringify({ uid: 'user-reg-aicte', exp: now + 1e6 })).toString('base64url');
    assert.equal(verifySessionToken(`${p}.${altered}.${sig}`), null, 'altered payload');

    const oldSecret = 'apaar-national-registry-hmac-secret-2026-nad-moe';
    const forgedSig = crypto.createHmac('sha256', oldSecret).update(body).digest('hex');
    assert.equal(verifySessionToken(`${p}.${body}.${forgedSig}`), null, 'signed with the old hard-coded secret');
  });

  it('revokes session tokens server-side on sign-out', () => {
    const now = Date.now();
    const token = issueSessionToken('user-logout-test', now);
    assert.deepEqual(verifySessionToken(token, now), { uid: 'user-logout-test' });
    assert.equal(isSessionTokenRevoked(token, now), false);
    assert.equal(revokeSessionToken(token, now), true);
    assert.equal(isSessionTokenRevoked(token, now), true);
    assert.equal(verifySessionToken(token, now), null, 'revoked token must be rejected');
  });
});

describe('Credential signatures', () => {
  it('verifies a server-signed credential', () => {
    const signed = signCredential(credential);
    assert.match(signed.digitalSignature, /^SIG-PKI-HMAC-[A-F0-9]{64}$/);
    assert.equal(verifyCredentialSignature(signed).valid, true);
  });

  it('detects an edited CGPA even if the plain SHA-256 digest is recomputed', () => {
    const signed = signCredential(credential);
    const edited = { ...signed, cgpaOrPercentage: '9.9 CGPA' };
    const reHashed = { ...edited, sha256Hash: signCredential(edited).sha256Hash };
    assert.equal(verifyCredentialSignature(reHashed).valid, false);
  });

  it('rejects credentials not signed by the server', () => {
    const fake = { ...credential, sha256Hash: 'ab'.repeat(32), digitalSignature: 'SIG-PKI-RSA-AICTE-0912448A8F' };
    assert.equal(verifyCredentialSignature(fake).valid, false);
  });
});

describe('OTP and rate limiting', () => {
  it('issues random one-time OTPs that work once', () => {
    const otp = issueOtp('apaar:123412341234');
    assert.match(otp, /^\d{6}$/);
    assert.equal(consumeOtp('apaar:123412341234', otp === '000000' ? '111111' : '000000'), false);
    assert.equal(consumeOtp('apaar:123412341234', otp), true);
    assert.equal(consumeOtp('apaar:123412341234', otp), false, 'second use fails');
  });

  it('locks an OTP after 5 wrong attempts', () => {
    const otp = issueOtp('apaar:999988887777');
    const wrong = otp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) consumeOtp('apaar:999988887777', wrong);
    assert.equal(consumeOtp('apaar:999988887777', otp), false);
  });

  it('limits attempts per key within a window', () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 60000), true);
    assert.equal(rateLimit(key, 3, 60000), false);
  });
});
