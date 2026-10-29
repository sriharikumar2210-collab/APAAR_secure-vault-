/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EducationStage =
  | 'Primary'
  | 'Middle'
  | 'Secondary'
  | 'Higher Secondary'
  | 'UG'
  | 'PG'
  | 'Graduated'
  | 'Left education';

export type StudentStatus = 'Active' | 'Graduated' | 'Dropped out';

export interface AcademicCredential {
  id: string;
  type: 'DEGREE' | 'MARKSHEET' | 'AICTE_APPROVAL' | 'ABC_TRANSCRIPT' | 'TRANSFER_CERTIFICATE';
  title: string;
  issuingInstitution: string;
  issuingAuthority: string;
  yearOfPassing: number;
  cgpaOrPercentage: string;
  specialization: string;
  digilockerUri: string;
  aicteApprovalNumber: string;
  sha256Hash: string;
  digitalSignature: string;
  issuerCertificateSerial: string;
  timestamp: string;
  isTampered?: boolean;
  documentFileName?: string;
  documentMimeType?: string;
  documentSizeBytes?: number;
  documentFileSha256?: string;
  documentDataUrl?: string;
  verified?: boolean;
  issueDate?: string;
  documentUploadedAt?: string;
}

export interface Student {
  apaarId: string; // 12-digit ID, e.g. "2990 9583 2586"
  pen: string; // 11-digit Permanent Education Number
  name: string;
  dob: string;
  gender: 'Female' | 'Male' | 'Other';
  currentInstitution: string;
  stage: EducationStage;
  gradeOrClass?: string;
  district: string;
  status: StudentStatus;
  aadhaarMismatch: boolean;
  consentPending: boolean;
  hasDigilockerAccount: boolean;
  digilockerDocumentsCount: number;
  abcCreditsBalance: number;
  credentials: AcademicCredential[];
  contactEmail: string;
  contactPhone: string;
}

export type VerificationStatus =
  | 'PENDING_STUDENT_CONSENT'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REJECTED'
  | 'CONSENT_REVOKED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'TAMPERED_FAILED';

export interface VerificationRequest {
  id: string;
  employerId: string;
  employerName: string;
  employerLogo?: string;
  verifierName: string;
  verifierRole: string;
  verifierEmail: string;
  verifierIp: string;
  studentApaarId: string;
  studentName: string;
  requestedCredentialTypes: AcademicCredential['type'][];
  purpose: string;
  requestedAt: string; // ISO
  consentExpiresAt: string; // ISO
  status: VerificationStatus;
  consentGrantedAt?: string;
  consentRevokedAt?: string;
  rejectionReason?: string;
  revocationReason?: string;
  scopeOfAccess: ('IDENTITY' | 'ACADEMIC_MARKS' | 'DIGITAL_SIGNATURE' | 'FULL_TRANSCRIPT')[];
  backendValidation?: {
    repositoryChecked: 'APAAR Secure Credential Vault' | 'AICTE Central Repository' | 'DigiLocker / NAD';
    signatureAlgorithm: 'RSA-SHA256' | 'ECDSA-SHA256' | 'HMAC-SHA256';
    certificateSerial: string;
    issuerCA: string;
    sha256Digest: string;
    verifiedAt: string;
    isTampered: boolean;
    tamperDetails?: string;
    networkLatencyMs: number;
    hrVerifiedBy?: string;
    hrOrganization?: string;
    hrRemarks?: string;
    ocrConfidencePercent?: number;
    ocrMatchedFields?: string;
  };
  auditTrailId: string;
}

export interface StudentConsentPreferences {
  autoApproveVettedEmployers: boolean;
  notifyViaSMS: boolean;
  notifyViaEmail: boolean;
  requireOtpForApproval: boolean;
  defaultValidityHours: number; // e.g. 24, 72, 168 (7 days)
  blacklistedEmployers: string[];
  allowedCredentials: AcademicCredential['type'][];
  dataPrivacyVersion: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  requestId?: string;
  studentApaarId: string;
  actor: string;
  actorType: 'EMPLOYER' | 'STUDENT' | 'SYSTEM' | 'AICTE_GATEWAY' | 'APAAR_VAULT' | 'DIGILOCKER_NAD';
  action:
    | 'REQUEST_INITIATED'
    | 'NOTIFICATION_DELIVERED'
    | 'CONSENT_GRANTED'
    | 'CONSENT_REJECTED'
    | 'CONSENT_REVOKED'
    | 'PREFERENCES_UPDATED'
    | 'AICTE_REPOSITORY_QUERIED'
    | 'DIGITAL_SIGNATURE_VERIFIED'
    | 'VAULT_DOCUMENT_SEALED'
    | 'SECURITY_TAMPER_ALERT'
    | 'REPORT_DOWNLOADED'
    | 'APAAR_ENROLLMENT_APPROVED';
  details: string;
  sha256Fingerprint: string;
  level: 'SUCCESS' | 'ALERT' | 'INFO';
}
