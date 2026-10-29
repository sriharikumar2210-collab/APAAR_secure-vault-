/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { getSecret } from './secrets.ts';
import { generateHash, buildCredentialCanonicalPayload } from '../utils/verificationEngine.ts';
import type { AcademicCredential } from '../types/index.ts';

// ---------------------------------------------------------------------------
// Passwords (scrypt, per-user random salt)
// ---------------------------------------------------------------------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith('scrypt$')) {
    // Run a dummy hash so timing does not reveal whether the account exists.
    crypto.scryptSync(password, 'dummy-salt-value', SCRYPT_KEYLEN);
    return false;
  }
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) {
    return 'Password is too long.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session tokens: carry only the user ID + expiry. Role and profile are
// re-read from the database on every request, so a token cannot claim a role.
// ---------------------------------------------------------------------------

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_PREFIX = 'apaar_st';

function signPart(encoded: string): string {
  return crypto.createHmac('sha256', getSecret('SESSION_SECRET')).update(encoded).digest('hex');
}

const revokedTokens = new Map<string, number>();

function cleanupRevokedTokens(now: number) {
  if (revokedTokens.size < 200) return;
  for (const [sig, exp] of revokedTokens.entries()) {
    if (exp < now) revokedTokens.delete(sig);
  }
}

export function issueSessionToken(uid: string, now = Date.now()): string {
  const payload = { uid, iat: now, exp: now + SESSION_TTL_MS, n: crypto.randomBytes(8).toString('hex') };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${TOKEN_PREFIX}.${encoded}.${signPart(encoded)}`;
}

export function isSessionTokenRevoked(token: string, now = Date.now()): boolean {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) return false;
  const sig = parts[2];
  const exp = revokedTokens.get(sig);
  if (exp === undefined) return false;
  if (exp < now) {
    revokedTokens.delete(sig);
    return false;
  }
  return true;
}

export function revokeSessionToken(token: string, now = Date.now()): boolean {
  const verified = verifySessionToken(token, now);
  if (!verified) return false;
  const parts = token.split('.');
  const [, encoded, sig] = parts;
  let exp = now + SESSION_TTL_MS;
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof decoded.exp === 'number') exp = decoded.exp;
  } catch {
    // ignore
  }
  cleanupRevokedTokens(now);
  revokedTokens.set(sig, exp);
  return true;
}

export function verifySessionToken(token: string, now = Date.now()): { uid: string } | null {
  if (typeof token !== 'string' || !token.startsWith(`${TOKEN_PREFIX}.`)) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, providedSig] = parts;
  const expectedSig = signPart(encoded);
  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
  ) {
    return null;
  }
  if (isSessionTokenRevoked(token, now)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof decoded.uid !== 'string' || typeof decoded.exp !== 'number' || decoded.exp < now) {
      return null;
    }
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Credential signing: keyed HMAC-SHA256 over the canonical credential fields.
// Only the server knows the key, so editing a CGPA and recomputing the plain
// SHA-256 no longer produces a valid signature.
// ---------------------------------------------------------------------------

type SignableCredential = Pick<
  AcademicCredential,
  'id' | 'title' | 'issuingInstitution' | 'yearOfPassing' | 'cgpaOrPercentage' | 'aicteApprovalNumber'
>;

export const SERVER_SIGNATURE_PREFIX = 'SIG-PKI-HMAC-';
export const SERVER_ISSUER_SERIAL = 'APAAR-SERVER-HMAC-SHA256';

function credentialMac(credential: SignableCredential): string {
  return crypto
    .createHmac('sha256', getSecret('CREDENTIAL_SIGNING_SECRET'))
    .update(buildCredentialCanonicalPayload(credential))
    .digest('hex')
    .toUpperCase();
}

/** Returns the credential with a fresh digest and server signature. */
export function signCredential<T extends SignableCredential>(credential: T): T & {
  sha256Hash: string;
  digitalSignature: string;
  issuerCertificateSerial: string;
} {
  return {
    ...credential,
    sha256Hash: generateHash(buildCredentialCanonicalPayload(credential)),
    digitalSignature: `${SERVER_SIGNATURE_PREFIX}${credentialMac(credential)}`,
    issuerCertificateSerial: SERVER_ISSUER_SERIAL,
  };
}

export function verifyCredentialSignature(
  credential: SignableCredential & { digitalSignature: string; sha256Hash: string }
): { valid: boolean; computedDigest: string; reason?: string } {
  const computedDigest = generateHash(buildCredentialCanonicalPayload(credential));
  if (typeof credential.digitalSignature !== 'string' || !credential.digitalSignature.startsWith(SERVER_SIGNATURE_PREFIX)) {
    return { valid: false, computedDigest, reason: 'Credential was not signed by the APAAR server.' };
  }
  const provided = credential.digitalSignature.slice(SERVER_SIGNATURE_PREFIX.length);
  const expected = credentialMac(credential);
  const matches =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!matches) {
    return {
      valid: false,
      computedDigest,
      reason: 'Signature does not match the credential contents. The record has been altered.',
    };
  }
  return { valid: true, computedDigest };
}

// ---------------------------------------------------------------------------
// One-time passwords for APAAR ID login (stored hashed, 5-minute expiry,
// limited attempts). An SMS gateway is still needed to deliver them.
// ---------------------------------------------------------------------------

interface OtpEntry {
  hash: string;
  expiresAt: number;
  attemptsLeft: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map<string, OtpEntry>();

function otpHash(key: string, otp: string): string {
  return crypto.createHmac('sha256', getSecret('SESSION_SECRET')).update(`${key}|${otp}`).digest('hex');
}

export function issueOtp(key: string, now = Date.now()): string {
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  otpStore.set(key, { hash: otpHash(key, otp), expiresAt: now + OTP_TTL_MS, attemptsLeft: 5 });
  return otp;
}

export function consumeOtp(key: string, otp: string, now = Date.now()): boolean {
  const entry = otpStore.get(key);
  if (!entry || entry.expiresAt < now || entry.attemptsLeft <= 0) {
    otpStore.delete(key);
    return false;
  }
  const a = Buffer.from(entry.hash);
  const b = Buffer.from(otpHash(key, String(otp || '')));
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    otpStore.delete(key);
    return true;
  }
  entry.attemptsLeft -= 1;
  return false;
}

// ---------------------------------------------------------------------------
// Simple fixed-window rate limiter (per key, in memory).
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function generateUid(role: string): string {
  return `user-${role.slice(0, 3).toLowerCase()}-${crypto.randomUUID()}`;
}

export function generateServerId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
