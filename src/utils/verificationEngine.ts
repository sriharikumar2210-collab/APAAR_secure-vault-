/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AcademicCredential,
  AuditLogEntry,
  StudentConsentPreferences,
  VerificationRequest,
  VerificationStatus,
} from '../types';

/**
 * Formats a raw 12-digit string into APAAR standard "XXXX XXXX XXXX"
 */
export function formatApaarId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

/**
 * Validates whether an APAAR ID is valid (12 digits, non-trivial)
 */
export function validateApaarId(apaarId: string): { isValid: boolean; error?: string } {
  const clean = apaarId.replace(/\s+/g, '');
  if (!clean) {
    return { isValid: false, error: 'APAAR ID is required.' };
  }
  if (!/^\d{12}$/.test(clean)) {
    return { isValid: false, error: 'APAAR ID must be exactly 12 numeric digits.' };
  }
  if (/^(\d)\1{11}$/.test(clean)) {
    return { isValid: false, error: 'Invalid APAAR ID checksum (repetitive sequence).' };
  }
  return { isValid: true };
}

// Standard FIPS 180-4 SHA-256 Round Constants
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Authentic FIPS 180-4 SHA-256 cryptographic hash generator (64-character hex digest)
 */
export function generateHash(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  const bitLen = utf8.length * 8;

  // Pad message to 512-bit (64-byte) multiple
  const totalBytes = Math.ceil((utf8.length + 9) / 64) * 64;
  const padded = new Uint8Array(totalBytes);
  padded.set(utf8);
  padded[utf8.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalBytes - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalBytes - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalBytes; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(v => v.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Builds the canonical payload string used to sign and verify an AcademicCredential
 */
export function buildCredentialCanonicalPayload(credential: {
  id: string;
  title: string;
  issuingInstitution: string;
  yearOfPassing: number;
  cgpaOrPercentage: string;
  aicteApprovalNumber: string;
}): string {
  return `${credential.id}|${credential.title}|${credential.issuingInstitution}|${credential.yearOfPassing}|${credential.cgpaOrPercentage}|${credential.aicteApprovalNumber}`;
}

/**
 * Browser-side integrity PREVIEW only: recomputes the plain SHA-256 digest of the credential fields
 * and checks the signature format. It cannot prove who issued a credential, because anyone can
 * recompute a plain digest. The authoritative check is the server's keyed signature verification
 * (POST /api/db/requests/:id/verify, see src/server/security.ts).
 */
export function verifyDigitalSignature(
  credential: AcademicCredential,
  simulateTamper = false
): {
  isVerified: boolean;
  algorithm: 'RSA-SHA256' | 'ECDSA-SHA256';
  issuerCA: string;
  certificateSerial: string;
  computedHash: string;
  expectedHash: string;
  tamperReason?: string;
  networkLatencyMs: number;
} {
  const payloadToHash = buildCredentialCanonicalPayload(credential);
  const computedHash = simulateTamper
    ? generateHash(payloadToHash + '|TAMPERED_RECORD')
    : generateHash(payloadToHash);
  const expectedHash = credential.sha256Hash;

  const hasValidSignatureEnvelope =
    typeof credential.digitalSignature === 'string' &&
    /^SIG-(PKI|X509)-[A-Z0-9-]+$/.test(credential.digitalSignature) &&
    typeof credential.issuerCertificateSerial === 'string' &&
    credential.issuerCertificateSerial.trim().length >= 6;

  const hashMatches =
    typeof expectedHash === 'string' &&
    /^[a-f0-9]{64}$/i.test(expectedHash) &&
    computedHash.toLowerCase() === expectedHash.toLowerCase();

  if (simulateTamper || credential.isTampered || !hashMatches || !hasValidSignatureEnvelope) {
    return {
      isVerified: false,
      algorithm: 'RSA-SHA256',
      issuerCA: 'AICTE Central Root CA - National Academic Depository (NAD)',
      certificateSerial: credential.issuerCertificateSerial || 'NAD-AICTE-PKI-2023-99812A',
      computedHash,
      expectedHash,
      tamperReason: !hasValidSignatureEnvelope
        ? 'Digital signature envelope or X.509 issuer certificate serial is missing or malformed.'
        : 'Cryptographic SHA-256 hash mismatch. Certificate payload altered: CGPA, title, or marks do not match AICTE ledger.',
      networkLatencyMs: 340,
    };
  }

  return {
    isVerified: true,
    algorithm: 'RSA-SHA256',
    issuerCA: 'AICTE Central Root CA - National Academic Depository (NAD)',
    certificateSerial: credential.issuerCertificateSerial,
    computedHash,
    expectedHash,
    networkLatencyMs: 285,
  };
}

/**
 * Determines if a new verification request can be auto-approved based on student's privacy preferences
 */
export function checkAutoApproval(
  employerName: string,
  credentialType: AcademicCredential['type'],
  preferences: StudentConsentPreferences
): boolean {
  if (preferences.blacklistedEmployers.some(e => e.toLowerCase() === employerName.toLowerCase())) {
    return false;
  }
  if (!preferences.allowedCredentials.includes(credentialType)) {
    return false;
  }
  if (preferences.autoApproveVettedEmployers) {
    const vettedEmployers = ['Tata Consultancy Services', 'Infosys', 'Zoho Corporation', 'Cognizant'];
    return vettedEmployers.includes(employerName);
  }
  return false;
}

/**
 * State transition validation for background verification requests
 */
export function transitionRequestStatus(
  currentStatus: VerificationStatus,
  targetStatus: VerificationStatus
): { allowed: boolean; error?: string } {
  const validTransitions: Record<VerificationStatus, VerificationStatus[]> = {
    PENDING_STUDENT_CONSENT: ['CONSENT_GRANTED', 'CONSENT_REJECTED'],
    CONSENT_GRANTED: ['VERIFYING', 'CONSENT_REVOKED'],
    VERIFYING: ['VERIFIED', 'TAMPERED_FAILED', 'CONSENT_REVOKED'],
    VERIFIED: ['CONSENT_REVOKED'],
    CONSENT_REJECTED: [],
    CONSENT_REVOKED: [],
    TAMPERED_FAILED: [],
  };

  const allowedNext = validTransitions[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Cannot transition verification request from ${currentStatus} to ${targetStatus}`,
    };
  }

  return { allowed: true };
}

/**
 * Creates an immutable audit log entry
 */
export function createAuditLog(
  actor: string,
  actorType: AuditLogEntry['actorType'],
  action: AuditLogEntry['action'],
  studentApaarId: string,
  details: string,
  level: AuditLogEntry['level'] = 'INFO',
  requestId?: string
): AuditLogEntry {
  const timestamp = new Date().toISOString();
  const rawFingerprint = `${timestamp}|${actor}|${action}|${studentApaarId}|${details}|${requestId || ''}`;
  const sha256Fingerprint = generateHash(rawFingerprint);

  return {
    id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestamp,
    requestId,
    studentApaarId,
    actor,
    actorType,
    action,
    details,
    sha256Fingerprint,
    level,
  };
}

/**
 * Generates a realistic, valid 12-digit APAAR ID formatted as "XXXX XXXX XXXX"
 */
export function generateValidApaarId(existingIds: string[] = []): string {
  const existingSet = new Set(existingIds.map(id => id.replace(/\s+/g, '')));

  for (let attempt = 0; attempt < 100; attempt++) {
    const firstDigit = Math.floor(1 + Math.random() * 8);
    let digits = `${firstDigit}`;
    for (let i = 1; i < 12; i++) {
      digits += Math.floor(Math.random() * 10).toString();
    }

    const validation = validateApaarId(digits);
    if (validation.isValid && !existingSet.has(digits)) {
      return formatApaarId(digits);
    }
  }

  const fallback = '3892' + Math.floor(10000000 + Math.random() * 90000000).toString();
  return formatApaarId(fallback);
}

/**
 * Generates an 11-digit Permanent Education Number (PEN) compliant with UDISE+ standard
 */
export function generatePenNumber(year = 2024): string {
  const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `${year}${random7}`;
}

/**
 * Constructs a cryptographically signed AcademicCredential with real SHA-256 hash
 */
export function createAcademicCredential(params: {
  type: AcademicCredential['type'];
  title: string;
  issuingInstitution: string;
  issuingAuthority: string;
  yearOfPassing: number;
  cgpaOrPercentage: string;
  specialization: string;
  aicteApprovalNumber?: string;
  apaarIdClean: string;
}): AcademicCredential {
  const credId = `CRED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const aicteNum =
    params.aicteApprovalNumber ||
    `AICTE-IN-${params.yearOfPassing}-${Math.floor(1000 + Math.random() * 9000)}`;
  const payloadToHash = buildCredentialCanonicalPayload({
    id: credId,
    title: params.title,
    issuingInstitution: params.issuingInstitution,
    yearOfPassing: params.yearOfPassing,
    cgpaOrPercentage: params.cgpaOrPercentage,
    aicteApprovalNumber: aicteNum,
  });
  const sha256Hash = generateHash(payloadToHash);
  const sigHex = generateHash(`SIG|${sha256Hash}|${params.apaarIdClean}`)
    .substring(0, 24)
    .toUpperCase();
  const certSerial = `NAD-PKI-${params.yearOfPassing}-${Math.floor(10000 + Math.random() * 90000)}E`;

  return {
    id: credId,
    type: params.type,
    title: params.title,
    issuingInstitution: params.issuingInstitution,
    issuingAuthority: params.issuingAuthority,
    yearOfPassing: params.yearOfPassing,
    cgpaOrPercentage: params.cgpaOrPercentage,
    specialization: params.specialization,
    digilockerUri: `vault://apaar-registry/${params.apaarIdClean.replace(/\D/g, '')}/${params.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${credId}`,
    aicteApprovalNumber: aicteNum,
    sha256Hash,
    digitalSignature: `SIG-PKI-RSA-${sigHex}`,
    issuerCertificateSerial: certSerial,
    timestamp: new Date().toISOString(),
    isTampered: false,
  };
}
