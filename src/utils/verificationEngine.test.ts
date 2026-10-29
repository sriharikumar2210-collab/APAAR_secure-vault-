/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatApaarId,
  validateApaarId,
  generateHash,
  verifyDigitalSignature,
  checkAutoApproval,
  transitionRequestStatus,
  createAuditLog,
  generateValidApaarId,
  generatePenNumber,
  createAcademicCredential,
} from './verificationEngine.ts';
import { AcademicCredential, StudentConsentPreferences } from '../types/index.ts';

test('formatApaarId formats 12 digits with spaces', () => {
  assert.equal(formatApaarId('299095832586'), '2990 9583 2586');
  assert.equal(formatApaarId('2990 9583 2586'), '2990 9583 2586');
});

test('validateApaarId validates 12 numeric digits and rejects invalid formats', () => {
  const valid = validateApaarId('2990 9583 2586');
  assert.equal(valid.isValid, true);

  const tooShort = validateApaarId('2990 9583');
  assert.equal(tooShort.isValid, false);
  assert.match(tooShort.error || '', /12 numeric digits/);

  const letters = validateApaarId('2990ABCD2586');
  assert.equal(letters.isValid, false);

  const repetitive = validateApaarId('1111 1111 1111');
  assert.equal(repetitive.isValid, false);
});

test('generateHash produces deterministic 64-character hex string', () => {
  const hash1 = generateHash('APAAR-CREDENTIAL-299095832586');
  const hash2 = generateHash('APAAR-CREDENTIAL-299095832586');
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('verifyDigitalSignature succeeds on authentic credential and fails on tampered credential', () => {
  const credentialPayload = 'CRED-01|B.Tech Information Technology|Institute of Technology, Attur|2023|8.82 CGPA|AICTE-TN-ENG-2019-8812';
  const authenticHash = generateHash(credentialPayload);

  const credential: AcademicCredential = {
    id: 'CRED-01',
    type: 'DEGREE',
    title: 'B.Tech Information Technology',
    issuingInstitution: 'Institute of Technology, Attur',
    issuingAuthority: 'Anna University / AICTE',
    yearOfPassing: 2023,
    cgpaOrPercentage: '8.82 CGPA',
    specialization: 'Information Technology',
    digilockerUri: 'in.gov.digilocker.annauniv.deg.2023.299095832586',
    aicteApprovalNumber: 'AICTE-TN-ENG-2019-8812',
    sha256Hash: authenticHash,
    digitalSignature: 'SIG-PKI-RSA-AICTE-0912448A8F',
    issuerCertificateSerial: 'NAD-AICTE-PKI-2023-74198E',
    timestamp: '2023-07-15T10:30:00Z',
  };

  const validResult = verifyDigitalSignature(credential, false);
  assert.equal(validResult.isVerified, true);
  assert.equal(validResult.algorithm, 'RSA-SHA256');

  // Test tampered
  const tamperedResult = verifyDigitalSignature(credential, true);
  assert.equal(tamperedResult.isVerified, false);
  assert.match(tamperedResult.tamperReason || '', /mismatch/i);
});

test('checkAutoApproval respects blacklists and preferences', () => {
  const prefs: StudentConsentPreferences = {
    autoApproveVettedEmployers: true,
    notifyViaSMS: true,
    notifyViaEmail: true,
    requireOtpForApproval: false,
    defaultValidityHours: 24,
    blacklistedEmployers: ['Suspicious Tech Corp'],
    allowedCredentials: ['DEGREE', 'ABC_TRANSCRIPT'],
    dataPrivacyVersion: 'DPDP-2023-V1.2',
  };

  // Blacklisted employer should never auto-approve
  assert.equal(checkAutoApproval('Suspicious Tech Corp', 'DEGREE', prefs), false);

  // Vetted employer with allowed credential
  assert.equal(checkAutoApproval('Tata Consultancy Services', 'DEGREE', prefs), true);

  // Unallowed credential
  assert.equal(checkAutoApproval('Tata Consultancy Services', 'MARKSHEET', prefs), false);
});

test('transitionRequestStatus enforces strict lifecycle and revocation', () => {
  assert.equal(transitionRequestStatus('PENDING_STUDENT_CONSENT', 'CONSENT_GRANTED').allowed, true);
  assert.equal(transitionRequestStatus('CONSENT_GRANTED', 'VERIFYING').allowed, true);
  assert.equal(transitionRequestStatus('VERIFYING', 'VERIFIED').allowed, true);
  // Student revoking verified credential access
  assert.equal(transitionRequestStatus('VERIFIED', 'CONSENT_REVOKED').allowed, true);
  // Invalid jump
  assert.equal(transitionRequestStatus('PENDING_STUDENT_CONSENT', 'VERIFIED').allowed, false);
});

test('createAuditLog produces verifiable entry with sha256Fingerprint', () => {
  const log = createAuditLog(
    'Student: Abinaya S',
    'STUDENT',
    'CONSENT_GRANTED',
    '2990 9583 2586',
    'Granted 24h access to TCS',
    'SUCCESS',
    'REQ-001'
  );

  assert.equal(log.actor, 'Student: Abinaya S');
  assert.equal(log.action, 'CONSENT_GRANTED');
  assert.equal(log.sha256Fingerprint.length, 64);
});

test('generateValidApaarId creates valid, properly-formatted 12-digit ID', () => {
  const apaarId = generateValidApaarId();
  assert.match(apaarId, /^\d{4} \d{4} \d{4}$/);
  const validation = validateApaarId(apaarId);
  assert.equal(validation.isValid, true);
});

test('generatePenNumber creates 11-digit UDISE-compliant number', () => {
  const pen = generatePenNumber(2025);
  assert.equal(pen.length, 11);
  assert.match(pen, /^2025\d{7}$/);
});

test('createAcademicCredential produces cryptographically verifiable credential', () => {
  const cred = createAcademicCredential({
    type: 'DEGREE',
    title: 'B.Tech Artificial Intelligence and Data Science',
    issuingInstitution: 'Anna University, Chennai',
    issuingAuthority: 'Controller of Examinations',
    yearOfPassing: 2025,
    cgpaOrPercentage: '9.15 CGPA',
    specialization: 'Artificial Intelligence',
    apaarIdClean: '481958210394',
  });

  assert.equal(cred.type, 'DEGREE');
  assert.equal(cred.sha256Hash.length, 64);
  assert.match(cred.digitalSignature, /^SIG-PKI-RSA-/);
  
  // Verify with digital signature engine
  const verification = verifyDigitalSignature(cred, false);
  assert.equal(verification.isVerified, true);
});

