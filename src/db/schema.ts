/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (Stores both Firebase Auth users and platform participants)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('STUDENT'), // STUDENT | EMPLOYER | INSTITUTION | REGULATOR
  organization: text('organization').notNull(),
  designation: text('designation'),
  phone: text('phone'),
  apaarId: text('apaar_id'),
  passwordHash: text('password_hash'), // scrypt hash; null for Google-only or locked accounts
  authProvider: text('auth_provider').notNull().default('password'), // password | google | apaar_otp
  isSeed: boolean('is_seed').notNull().default(false), // pre-loaded demo account
  institutionApproved: boolean('institution_approved').notNull().default(true), // self-registered institutions start false until regulator approves
  createdAt: timestamp('created_at').defaultNow(),
});

// National Student Registry Table
export const students = pgTable('students', {
  apaarId: text('apaar_id').primaryKey(),
  pen: text('pen').notNull(),
  name: text('name').notNull(),
  dob: text('dob').notNull(),
  gender: text('gender').notNull(),
  currentInstitution: text('current_institution').notNull(),
  stage: text('stage').notNull(),
  district: text('district').notNull(),
  status: text('status').notNull().default('Active'),
  consentPending: boolean('consent_pending').notNull().default(false),
  hasDigilockerAccount: boolean('has_digilocker_account').notNull().default(true),
  digilockerDocumentsCount: integer('digilocker_documents_count').notNull().default(0),
  abcCreditsBalance: integer('abc_credits_balance').notNull().default(0),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  createdByUid: text('created_by_uid'), // institution (or student) account that registered the record
  createdAt: timestamp('created_at').defaultNow(),
});

// Academic Credentials (APAAR Secure Vault & AICTE verified certificates)
export const credentials = pgTable('credentials', {
  id: text('id').primaryKey(),
  studentApaarId: text('student_apaar_id')
    .references(() => students.apaarId)
    .notNull(),
  type: text('type').notNull(), // DEGREE | MARKSHEET | AICTE_APPROVAL | ABC_TRANSCRIPT
  title: text('title').notNull(),
  issuingInstitution: text('issuing_institution').notNull(),
  issuingAuthority: text('issuing_authority').notNull(),
  yearOfPassing: integer('year_of_passing').notNull(),
  cgpaOrPercentage: text('cgpa_or_percentage').notNull(),
  specialization: text('specialization').notNull(),
  digilockerUri: text('digilocker_uri').notNull(),
  aicteApprovalNumber: text('aicte_approval_number').notNull(),
  sha256Hash: text('sha256_hash').notNull(),
  digitalSignature: text('digital_signature').notNull(),
  issuerCertificateSerial: text('issuer_certificate_serial').notNull(),
  timestamp: text('timestamp').notNull(),
  documentFileName: text('document_file_name'),
  documentMimeType: text('document_mime_type'),
  documentSizeBytes: integer('document_size_bytes'),
  documentFileSha256: text('document_file_sha256'),
  documentDataUrl: text('document_data_url'),
});

// Employer Background Verification Requests
export const verificationRequests = pgTable('verification_requests', {
  id: text('id').primaryKey(),
  employerId: text('employer_id').notNull(),
  employerName: text('employer_name').notNull(),
  verifierName: text('verifier_name').notNull(),
  verifierRole: text('verifier_role').notNull(),
  verifierEmail: text('verifier_email').notNull(),
  studentApaarId: text('student_apaar_id').notNull(),
  studentName: text('student_name').notNull(),
  requestedCredentialTypes: text('requested_credential_types').notNull(), // JSON
  purpose: text('purpose').notNull(),
  requestedAt: text('requested_at').notNull(),
  consentExpiresAt: text('consent_expires_at').notNull(),
  status: text('status').notNull(), // PENDING_STUDENT_CONSENT | CONSENT_GRANTED | etc.
  consentGrantedAt: text('consent_granted_at'),
  consentRevokedAt: text('consent_revoked_at'),
  rejectionReason: text('rejection_reason'),
  revocationReason: text('revocation_reason'),
  backendValidation: text('backend_validation'), // JSON, set only by the server verify step
  employerUid: text('employer_uid'), // employer account that owns the request
  scopeOfAccess: text('scope_of_access').notNull(), // JSON
});

// Immutable DPDP Audit Trail
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  requestId: text('request_id'),
  studentApaarId: text('student_apaar_id').notNull(),
  actor: text('actor').notNull(),
  actorType: text('actor_type').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  sha256Fingerprint: text('sha256_fingerprint').notNull(),
  level: text('level').notNull(), // SUCCESS | ALERT | INFO
  actorUid: text('actor_uid'), // verified account that wrote the entry (null = server)
});

// Drizzle relations
export const studentsRelations = relations(students, ({ many }) => ({
  credentials: many(credentials),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  student: one(students, {
    fields: [credentials.studentApaarId],
    references: [students.apaarId],
  }),
}));
