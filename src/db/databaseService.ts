/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { db, isDatabaseConfigured } from './index.ts';
import { users, students, verificationRequests, auditLogs, credentials } from './schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import type { Student, AcademicCredential, VerificationRequest, AuditLogEntry } from '../types/index.ts';
import type { StoredStudent, StoredRequest, StoredAuditLog, Role } from '../server/accessRules.ts';
import { DEFAULT_USER_ACCOUNTS, DEMO_EMPLOYER_ACCOUNTS } from '../data/demoAccounts.ts';
import { generateFullStudentRegistry, INITIAL_VERIFICATION_REQUESTS, INITIAL_AUDIT_LOGS } from '../data/mockData.ts';
import { signCredential } from '../server/security.ts';
import { ensureVaultUri } from '../utils/vaultEngine.ts';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Persistent local ledger + In-memory store (used when PostgreSQL is not configured/reachable)
// ---------------------------------------------------------------------------

let useMemoryStore = !isDatabaseConfigured();
let diskPersistenceEnabled = false;
const VAULT_DB_FILE = path.resolve(process.cwd(), '.apaar-vault-db.json');

const memUsers = new Map<string, DbUser>();
const memStudents = new Map<string, StoredStudent>();
const memRequests = new Map<string, StoredRequest>();
const memAuditLogs: StoredAuditLog[] = [];

function loadFromDiskStore(): void {
  if (!diskPersistenceEnabled) return;
  try {
    if (!fs.existsSync(VAULT_DB_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(VAULT_DB_FILE, 'utf-8'));
    if (Array.isArray(raw.users)) {
      for (const u of raw.users) {
        if (u && u.uid) memUsers.set(u.uid, u);
      }
    }
    if (Array.isArray(raw.students)) {
      for (const s of raw.students) {
        if (s && s.apaarId) memStudents.set(s.apaarId, s);
      }
    }
    if (Array.isArray(raw.requests)) {
      for (const r of raw.requests) {
        if (r && r.id) memRequests.set(r.id, r);
      }
    }
    if (Array.isArray(raw.auditLogs)) {
      memAuditLogs.length = 0;
      for (const l of raw.auditLogs) {
        if (l && l.id) memAuditLogs.push(l);
      }
    }
  } catch (err) {
    console.warn('[db] Could not read persistent vault file; initializing fresh ledger.', err);
  }
}

function saveToDiskStore(): void {
  if (!diskPersistenceEnabled || !useMemoryStore) return;
  try {
    const payload = {
      updatedAt: new Date().toISOString(),
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId,
      users: Array.from(memUsers.values()),
      students: Array.from(memStudents.values()),
      requests: Array.from(memRequests.values()),
      auditLogs: memAuditLogs.slice(0, 500),
    };
    fs.writeFileSync(VAULT_DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[db] Could not persist vault ledger to disk:', err);
  }
}

export function isUsingMemoryStore(): boolean {
  return useMemoryStore;
}

const cleanDigits = (val: string | null | undefined) => String(val || '').replace(/\D/g, '');


// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface DbUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
  organization: string;
  designation: string;
  phone: string;
  apaarId: string | null;
  passwordHash: string | null;
  authProvider: string;
  isSeed: boolean;
  institutionApproved: boolean;
  createdAt: string;
}

function mapUser(u: typeof users.$inferSelect): DbUser {
  return {
    uid: u.uid,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    organization: u.organization,
    designation: u.designation || '',
    phone: u.phone || '',
    apaarId: u.apaarId || null,
    passwordHash: u.passwordHash || null,
    authProvider: u.authProvider,
    isSeed: u.isSeed,
    institutionApproved: u.institutionApproved !== false,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
  };
}

/** Public profile: never includes the password hash. */
export function toPublicUser(u: DbUser) {
  return {
    id: u.uid,
    name: u.name,
    email: u.email,
    role: u.role,
    organization: u.organization,
    designation: u.designation,
    phone: u.phone,
    apaarId: u.apaarId || undefined,
    institutionApproved: u.institutionApproved,
    createdAt: u.createdAt,
    lastActive: new Date().toISOString(),
  };
}

export async function getUserByUid(uid: string): Promise<DbUser | null> {
  if (useMemoryStore) {
    return memUsers.get(uid) || null;
  }
  const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const target = email.trim().toLowerCase();
  if (useMemoryStore) {
    for (const u of memUsers.values()) {
      if (u.email.toLowerCase() === target) return u;
    }
    return null;
  }
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${target}`)
    .limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByApaarId(apaarDigits: string): Promise<DbUser | null> {
  const target = cleanDigits(apaarDigits);
  if (useMemoryStore) {
    for (const u of memUsers.values()) {
      if (cleanDigits(u.apaarId) === target && target.length > 0) return u;
    }
    return null;
  }
  const rows = await db
    .select()
    .from(users)
    .where(sql`regexp_replace(coalesce(${users.apaarId}, ''), '\\D', '', 'g') = ${target}`)
    .limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getAllUsers(): Promise<DbUser[]> {
  if (useMemoryStore) {
    return Array.from(memUsers.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map(mapUser);
}

export async function createUser(u: {
  uid: string;
  name: string;
  email: string;
  role: Role;
  organization: string;
  designation?: string;
  phone?: string;
  apaarId?: string | null;
  passwordHash?: string | null;
  authProvider?: string;
  isSeed?: boolean;
  institutionApproved?: boolean;
}): Promise<DbUser> {
  const approved = u.institutionApproved !== undefined ? u.institutionApproved : true;
  if (useMemoryStore) {
    const created: DbUser = {
      uid: u.uid,
      name: u.name,
      email: u.email.trim().toLowerCase(),
      role: u.role,
      organization: u.organization,
      designation: u.designation || '',
      phone: u.phone || '',
      apaarId: u.apaarId || null,
      passwordHash: u.passwordHash || null,
      authProvider: u.authProvider || 'password',
      isSeed: !!u.isSeed,
      institutionApproved: approved,
      createdAt: new Date().toISOString(),
    };
    memUsers.set(created.uid, created);
    saveToDiskStore();
    return created;
  }
  const rows = await db
    .insert(users)
    .values({
      uid: u.uid,
      name: u.name,
      email: u.email.trim().toLowerCase(),
      role: u.role,
      organization: u.organization,
      designation: u.designation || '',
      phone: u.phone || '',
      apaarId: u.apaarId || null,
      passwordHash: u.passwordHash || null,
      authProvider: u.authProvider || 'password',
      isSeed: !!u.isSeed,
      institutionApproved: approved,
    })
    .returning();
  return mapUser(rows[0]);
}

/** Profile edits by the user themself. Role, email, APAAR ID and password are not editable here. */
export async function updateUserProfile(
  uid: string,
  fields: { name?: string; organization?: string; designation?: string; phone?: string }
): Promise<DbUser | null> {
  if (useMemoryStore) {
    const existing = memUsers.get(uid);
    if (!existing) return null;
    const updated: DbUser = {
      ...existing,
      name: fields.name || existing.name,
      organization: fields.organization || existing.organization,
      designation: typeof fields.designation === 'string' ? fields.designation : existing.designation,
      phone: typeof fields.phone === 'string' ? fields.phone : existing.phone,
    };
    memUsers.set(uid, updated);
    saveToDiskStore();
    return updated;
  }
  const set: Record<string, string> = {};
  if (fields.name) set.name = fields.name;
  if (fields.organization) set.organization = fields.organization;
  if (typeof fields.designation === 'string') set.designation = fields.designation;
  if (typeof fields.phone === 'string') set.phone = fields.phone;
  if (Object.keys(set).length === 0) return getUserByUid(uid);
  const rows = await db.update(users).set(set).where(eq(users.uid, uid)).returning();
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function setInstitutionApproval(uid: string, approved: boolean): Promise<DbUser | null> {
  if (useMemoryStore) {
    const existing = memUsers.get(uid);
    if (!existing) return null;
    const updated: DbUser = { ...existing, institutionApproved: approved };
    memUsers.set(uid, updated);
    saveToDiskStore();
    return updated;
  }
  const rows = await db.update(users).set({ institutionApproved: approved }).where(eq(users.uid, uid)).returning();
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function setSeedAccountPasswords(passwordHash: string | null): Promise<void> {
  if (useMemoryStore) {
    for (const [uid, u] of memUsers.entries()) {
      if (u.isSeed) {
        memUsers.set(uid, { ...u, passwordHash });
      }
    }
    return;
  }
  await db.update(users).set({ passwordHash }).where(eq(users.isSeed, true));
}

// ---------------------------------------------------------------------------
// Students & credentials
// ---------------------------------------------------------------------------

function mapCredential(c: typeof credentials.$inferSelect): AcademicCredential {
  return {
    id: c.id,
    type: c.type as AcademicCredential['type'],
    title: c.title,
    issuingInstitution: c.issuingInstitution,
    issuingAuthority: c.issuingAuthority,
    yearOfPassing: c.yearOfPassing,
    cgpaOrPercentage: c.cgpaOrPercentage,
    specialization: c.specialization,
    digilockerUri: ensureVaultUri(c.digilockerUri, c.studentApaarId, c.id, c.type),
    aicteApprovalNumber: c.aicteApprovalNumber,
    sha256Hash: c.sha256Hash,
    digitalSignature: c.digitalSignature,
    issuerCertificateSerial: c.issuerCertificateSerial,
    timestamp: c.timestamp,
    ...(c.documentFileName ? { documentFileName: c.documentFileName } : {}),
    ...(c.documentMimeType ? { documentMimeType: c.documentMimeType } : {}),
    ...(typeof c.documentSizeBytes === 'number' ? { documentSizeBytes: c.documentSizeBytes } : {}),
    ...(c.documentFileSha256 ? { documentFileSha256: c.documentFileSha256 } : {}),
    ...(c.documentDataUrl ? { documentDataUrl: c.documentDataUrl } : {}),
  };
}

function mapStudent(s: typeof students.$inferSelect, creds: AcademicCredential[]): StoredStudent {
  return {
    apaarId: s.apaarId,
    pen: s.pen,
    name: s.name,
    dob: s.dob,
    gender: (s.gender as Student['gender']) || 'Female',
    currentInstitution: s.currentInstitution,
    stage: s.stage as Student['stage'],
    district: s.district,
    status: (s.status as Student['status']) || 'Active',
    aadhaarMismatch: false,
    consentPending: s.consentPending,
    hasDigilockerAccount: s.hasDigilockerAccount,
    digilockerDocumentsCount: s.digilockerDocumentsCount,
    abcCreditsBalance: s.abcCreditsBalance,
    credentials: creds,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    createdByUid: s.createdByUid || null,
  };
}

export async function getAllStudentsStored(): Promise<StoredStudent[]> {
  if (useMemoryStore) {
    return Array.from(memStudents.values());
  }
  const studentRows = await db.select().from(students).orderBy(desc(students.createdAt));
  const credRows = await db.select().from(credentials);
  const byStudent = new Map<string, AcademicCredential[]>();
  for (const c of credRows) {
    const list = byStudent.get(c.studentApaarId) || [];
    list.push(mapCredential(c));
    byStudent.set(c.studentApaarId, list);
  }
  return studentRows.map(s => mapStudent(s, byStudent.get(s.apaarId) || []));
}

const apaarDigitsSql = (col: any) => sql`regexp_replace(${col}, '\\D', '', 'g')`;

export async function getStudentStored(apaarId: string): Promise<StoredStudent | null> {
  const digits = cleanDigits(apaarId);
  if (useMemoryStore) {
    for (const s of memStudents.values()) {
      if (cleanDigits(s.apaarId) === digits && digits.length > 0) return s;
    }
    return null;
  }
  const rows = await db.select().from(students).where(sql`${apaarDigitsSql(students.apaarId)} = ${digits}`).limit(1);
  if (!rows[0]) return null;
  const creds = await db.select().from(credentials).where(eq(credentials.studentApaarId, rows[0].apaarId));
  return mapStudent(rows[0], creds.map(mapCredential));
}

/** Inserts a new student. Credentials passed here must already be server-signed. */
export async function insertStudent(student: Student, createdByUid: string): Promise<void> {
  if (useMemoryStore) {
    const stored: StoredStudent = {
      apaarId: student.apaarId,
      pen: student.pen || '',
      name: student.name,
      dob: student.dob || '',
      gender: (student.gender as Student['gender']) || 'Other',
      currentInstitution: student.currentInstitution,
      stage: student.stage,
      district: student.district || '',
      status: (student.status as Student['status']) || 'Active',
      aadhaarMismatch: false,
      consentPending: !!student.consentPending,
      hasDigilockerAccount: student.hasDigilockerAccount !== false,
      digilockerDocumentsCount: Number(student.digilockerDocumentsCount) || 0,
      abcCreditsBalance: Number(student.abcCreditsBalance) || 0,
      credentials: student.credentials ? [...student.credentials] : [],
      contactEmail: student.contactEmail || '',
      contactPhone: student.contactPhone || '',
      createdByUid,
    };
    memStudents.set(student.apaarId, stored);
    saveToDiskStore();
    return;
  }
  await db.insert(students).values({
    apaarId: student.apaarId,
    pen: student.pen || '',
    name: student.name,
    dob: student.dob || '',
    gender: student.gender || 'Other',
    currentInstitution: student.currentInstitution,
    stage: student.stage,
    district: student.district || '',
    status: student.status || 'Active',
    consentPending: !!student.consentPending,
    hasDigilockerAccount: student.hasDigilockerAccount !== false,
    digilockerDocumentsCount: Number(student.digilockerDocumentsCount) || 0,
    abcCreditsBalance: Number(student.abcCreditsBalance) || 0,
    contactEmail: student.contactEmail || '',
    contactPhone: student.contactPhone || '',
    createdByUid,
  });
}

export async function updateStudentFields(
  apaarId: string,
  fields: Partial<Pick<Student, 'name' | 'currentInstitution' | 'stage' | 'status' | 'consentPending' | 'digilockerDocumentsCount' | 'abcCreditsBalance' | 'contactEmail' | 'contactPhone' | 'district'>>
): Promise<void> {
  if (useMemoryStore) {
    const existing = await getStudentStored(apaarId);
    if (!existing) return;
    const updated: StoredStudent = { ...existing };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) (updated as any)[k] = v;
    }
    memStudents.set(existing.apaarId, updated);
    saveToDiskStore();
    return;
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) set[k] = v;
  }
  if (Object.keys(set).length === 0) return;
  await db.update(students).set(set).where(eq(students.apaarId, apaarId));
}

/** Adds credentials. Existing credential IDs are never overwritten (credentials are immutable). */
export async function insertCredentials(studentApaarId: string, creds: AcademicCredential[]): Promise<void> {
  if (useMemoryStore) {
    const existing = await getStudentStored(studentApaarId);
    if (!existing) return;
    const currentCreds = [...existing.credentials];
    for (const cred of creds) {
      if (!currentCreds.some(c => c.id === cred.id)) {
        currentCreds.push(cred);
      }
    }
    memStudents.set(existing.apaarId, { ...existing, credentials: currentCreds });
    saveToDiskStore();
    return;
  }
  for (const cred of creds) {
    await db
      .insert(credentials)
      .values({
        id: cred.id,
        studentApaarId,
        type: cred.type,
        title: cred.title,
        issuingInstitution: cred.issuingInstitution,
        issuingAuthority: cred.issuingAuthority,
        yearOfPassing: cred.yearOfPassing,
        cgpaOrPercentage: cred.cgpaOrPercentage,
        specialization: cred.specialization,
        digilockerUri: cred.digilockerUri,
        aicteApprovalNumber: cred.aicteApprovalNumber,
        sha256Hash: cred.sha256Hash,
        digitalSignature: cred.digitalSignature,
        issuerCertificateSerial: cred.issuerCertificateSerial,
        timestamp: cred.timestamp,
        documentFileName: cred.documentFileName || null,
        documentMimeType: cred.documentMimeType || null,
        documentSizeBytes: typeof cred.documentSizeBytes === 'number' ? cred.documentSizeBytes : null,
        documentFileSha256: cred.documentFileSha256 || null,
        documentDataUrl: cred.documentDataUrl || null,
      })
      .onConflictDoNothing();
  }
}

// ---------------------------------------------------------------------------
// Verification requests
// ---------------------------------------------------------------------------

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapRequest(r: typeof verificationRequests.$inferSelect): StoredRequest {
  return {
    id: r.id,
    employerId: r.employerId,
    employerName: r.employerName,
    verifierName: r.verifierName,
    verifierRole: r.verifierRole,
    verifierEmail: r.verifierEmail,
    verifierIp: '',
    studentApaarId: r.studentApaarId,
    studentName: r.studentName,
    requestedCredentialTypes: parseJson(r.requestedCredentialTypes, ['DEGREE'] as AcademicCredential['type'][]),
    purpose: r.purpose,
    requestedAt: r.requestedAt,
    consentExpiresAt: r.consentExpiresAt,
    status: r.status as VerificationRequest['status'],
    consentGrantedAt: r.consentGrantedAt || undefined,
    consentRevokedAt: r.consentRevokedAt || undefined,
    rejectionReason: r.rejectionReason || undefined,
    revocationReason: r.revocationReason || undefined,
    scopeOfAccess: parseJson(r.scopeOfAccess, ['IDENTITY'] as VerificationRequest['scopeOfAccess']),
    backendValidation: parseJson(r.backendValidation, undefined),
    auditTrailId: `AUDIT-${r.id}`,
    employerUid: r.employerUid || null,
  };
}

export async function getAllRequestsStored(): Promise<StoredRequest[]> {
  if (useMemoryStore) {
    return Array.from(memRequests.values());
  }
  const rows = await db.select().from(verificationRequests);
  return rows.map(mapRequest);
}

export async function getRequestStored(id: string): Promise<StoredRequest | null> {
  if (useMemoryStore) {
    return memRequests.get(id) || null;
  }
  const rows = await db.select().from(verificationRequests).where(eq(verificationRequests.id, id)).limit(1);
  return rows[0] ? mapRequest(rows[0]) : null;
}

/** Inserts a new request. Returns false if the ID already exists (requests are never overwritten). */
export async function insertRequest(req: VerificationRequest, employerUid: string): Promise<boolean> {
  if (useMemoryStore) {
    if (memRequests.has(req.id)) return false;
    const stored: StoredRequest = {
      ...req,
      verifierIp: '',
      auditTrailId: `AUDIT-${req.id}`,
      employerUid,
    };
    memRequests.set(req.id, stored);
    saveToDiskStore();
    return true;
  }
  const rows = await db
    .insert(verificationRequests)
    .values({
      id: req.id,
      employerId: req.employerId,
      employerName: req.employerName,
      verifierName: req.verifierName,
      verifierRole: req.verifierRole,
      verifierEmail: req.verifierEmail,
      studentApaarId: req.studentApaarId,
      studentName: req.studentName,
      requestedCredentialTypes: JSON.stringify(req.requestedCredentialTypes),
      purpose: req.purpose,
      requestedAt: req.requestedAt,
      consentExpiresAt: req.consentExpiresAt,
      status: req.status,
      consentGrantedAt: req.consentGrantedAt || null,
      consentRevokedAt: req.consentRevokedAt || null,
      rejectionReason: req.rejectionReason || null,
      revocationReason: req.revocationReason || null,
      backendValidation: req.backendValidation ? JSON.stringify(req.backendValidation) : null,
      scopeOfAccess: JSON.stringify(req.scopeOfAccess),
      employerUid,
    })
    .onConflictDoNothing()
    .returning({ id: verificationRequests.id });
  return rows.length > 0;
}

export async function updateRequestFields(
  id: string,
  fields: Partial<{
    status: VerificationRequest['status'];
    consentGrantedAt: string | null;
    consentRevokedAt: string | null;
    consentExpiresAt: string;
    rejectionReason: string | null;
    revocationReason: string | null;
    scopeOfAccess: VerificationRequest['scopeOfAccess'];
    backendValidation: VerificationRequest['backendValidation'] | null;
  }>
): Promise<StoredRequest | null> {
  if (useMemoryStore) {
    const existing = memRequests.get(id);
    if (!existing) return null;
    const updated: StoredRequest = { ...existing };
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      (updated as any)[k] = v === null ? undefined : v;
    }
    memRequests.set(id, updated);
    saveToDiskStore();
    return updated;
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (k === 'scopeOfAccess') set.scopeOfAccess = JSON.stringify(v);
    else if (k === 'backendValidation') set.backendValidation = v ? JSON.stringify(v) : null;
    else set[k] = v;
  }
  const rows = await db.update(verificationRequests).set(set).where(eq(verificationRequests.id, id)).returning();
  return rows[0] ? mapRequest(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Audit logs (append-only)
// ---------------------------------------------------------------------------

function mapAudit(l: typeof auditLogs.$inferSelect): StoredAuditLog {
  return {
    id: l.id,
    timestamp: l.timestamp,
    requestId: l.requestId || undefined,
    studentApaarId: l.studentApaarId,
    actor: l.actor,
    actorType: l.actorType as AuditLogEntry['actorType'],
    action: l.action as AuditLogEntry['action'],
    details: l.details,
    sha256Fingerprint: l.sha256Fingerprint,
    level: l.level as AuditLogEntry['level'],
    actorUid: l.actorUid || null,
  };
}

export async function getAllAuditLogsStored(): Promise<StoredAuditLog[]> {
  if (useMemoryStore) {
    return [...memAuditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  return rows.map(mapAudit);
}

export async function insertAuditLog(log: AuditLogEntry, actorUid: string | null): Promise<StoredAuditLog> {
  if (useMemoryStore) {
    const stored: StoredAuditLog = { ...log, actorUid };
    memAuditLogs.unshift(stored);
    saveToDiskStore();
    return stored;
  }
  await db.insert(auditLogs).values({
    id: log.id,
    timestamp: log.timestamp,
    requestId: log.requestId || null,
    studentApaarId: log.studentApaarId,
    actor: log.actor,
    actorType: log.actorType,
    action: log.action,
    details: log.details,
    sha256Fingerprint: log.sha256Fingerprint,
    level: log.level,
    actorUid,
  });
  return { ...log, actorUid };
}

// ---------------------------------------------------------------------------
// Schema setup & demo data
// ---------------------------------------------------------------------------

export async function ensureDatabaseTables(): Promise<void> {
  if (!isDatabaseConfigured()) {
    useMemoryStore = true;
    diskPersistenceEnabled = true;
    loadFromDiskStore();
    return;
  }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'STUDENT',
        organization TEXT NOT NULL DEFAULT 'General User',
        designation TEXT,
        phone TEXT,
        apaar_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS students (
        apaar_id TEXT PRIMARY KEY,
        pen TEXT NOT NULL,
        name TEXT NOT NULL,
        dob TEXT NOT NULL,
        gender TEXT NOT NULL DEFAULT 'Female',
        current_institution TEXT NOT NULL,
        stage TEXT NOT NULL,
        district TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        consent_pending BOOLEAN NOT NULL DEFAULT false,
        has_digilocker_account BOOLEAN NOT NULL DEFAULT true,
        digilocker_documents_count INTEGER NOT NULL DEFAULT 1,
        abc_credits_balance INTEGER NOT NULL DEFAULT 0,
        contact_email TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        student_apaar_id TEXT NOT NULL REFERENCES students(apaar_id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        issuing_institution TEXT NOT NULL,
        issuing_authority TEXT NOT NULL,
        year_of_passing INTEGER NOT NULL,
        cgpa_or_percentage TEXT NOT NULL,
        specialization TEXT NOT NULL,
        digilocker_uri TEXT NOT NULL,
        aicte_approval_number TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        digital_signature TEXT NOT NULL,
        issuer_certificate_serial TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS verification_requests (
        id TEXT PRIMARY KEY,
        employer_id TEXT NOT NULL,
        employer_name TEXT NOT NULL,
        verifier_name TEXT NOT NULL,
        verifier_role TEXT NOT NULL,
        verifier_email TEXT NOT NULL,
        student_apaar_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        requested_credential_types TEXT NOT NULL,
        purpose TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        consent_expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING_STUDENT_CONSENT',
        consent_granted_at TEXT,
        scope_of_access TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        request_id TEXT,
        student_apaar_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        sha256_fingerprint TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'INFO'
      );

      -- Columns added in version 6 (safe to run on existing databases)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_approved BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS created_by_uid TEXT;
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS consent_revoked_at TEXT;
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS backend_validation TEXT;
      ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS employer_uid TEXT;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_uid TEXT;
      ALTER TABLE credentials ADD COLUMN IF NOT EXISTS document_file_name TEXT;
      ALTER TABLE credentials ADD COLUMN IF NOT EXISTS document_mime_type TEXT;
      ALTER TABLE credentials ADD COLUMN IF NOT EXISTS document_size_bytes INTEGER;
      ALTER TABLE credentials ADD COLUMN IF NOT EXISTS document_file_sha256 TEXT;
      ALTER TABLE credentials ADD COLUMN IF NOT EXISTS document_data_url TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
    `);
    useMemoryStore = false;
  } catch (err) {
    console.warn('[AI Studio] PostgreSQL unreachable — falling back to persistent local Vault ledger.');
    useMemoryStore = true;
    diskPersistenceEnabled = true;
    loadFromDiskStore();
  }
}

export interface VaultDatabaseDiagnostics {
  connected: boolean;
  databaseName: string;
  projectId: string;
  storageEngine: string;
  postgresActive: boolean;
  persistentLedgerFile: string;
  totalStudents: number;
  totalSealedCredentials: number;
  totalUploadedDocuments: number;
  totalAuditLogs: number;
  lastSyncedAt: string;
}

export async function getVaultDatabaseDiagnostics(): Promise<VaultDatabaseDiagnostics> {
  const allStudents = await getAllStudentsStored();
  const allLogs = await getAllAuditLogsStored();
  let totalSealedCredentials = 0;
  let totalUploadedDocuments = 0;
  for (const s of allStudents) {
    totalSealedCredentials += s.credentials.length;
    for (const c of s.credentials) {
      if (c.documentFileName || c.documentDataUrl) {
        totalUploadedDocuments += 1;
      }
    }
  }
  return {
    connected: true,
    databaseName: firebaseConfig.firestoreDatabaseId,
    projectId: firebaseConfig.projectId,
    storageEngine: useMemoryStore
      ? 'APAAR Vault Persistent DB + Firestore Ledger'
      : 'PostgreSQL (credentials table) + Firestore Ledger',
    postgresActive: !useMemoryStore,
    persistentLedgerFile: '.apaar-vault-db.json',
    totalStudents: allStudents.length,
    totalSealedCredentials,
    totalUploadedDocuments,
    totalAuditLogs: allLogs.length,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Demo accounts are always ensured (existing accounts with the same ID or email are left alone).
 * The sample registry and requests are loaded only into an empty database.
 */
export async function seedDemoDataIfEmpty(): Promise<boolean> {
  if (useMemoryStore) {
    for (const acc of [...DEFAULT_USER_ACCOUNTS, ...DEMO_EMPLOYER_ACCOUNTS]) {
      const existing = memUsers.get(acc.id);
      memUsers.set(acc.id, {
        uid: acc.id,
        name: acc.name,
        email: acc.email.toLowerCase(),
        role: acc.role,
        organization: acc.organization,
        designation: acc.designation || '',
        phone: acc.phone || '',
        apaarId: acc.apaarId || null,
        passwordHash: existing?.passwordHash || null,
        authProvider: 'password',
        isSeed: true,
        institutionApproved: true,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    }

    if (memStudents.size > 0) {
      saveToDiskStore();
      return false;
    }

    const seedInstitutionUid = 'user-inst-annauniv';
    for (const student of generateFullStudentRegistry()) {
      await insertStudent({ ...student, credentials: [] }, seedInstitutionUid);
      await insertCredentials(
        student.apaarId,
        student.credentials.map(c =>
          signCredential({
            ...c,
            digilockerUri: ensureVaultUri(c.digilockerUri, student.apaarId, c.id, c.type),
          })
        )
      );
    }

    const employerByOrg = new Map(
      [...DEFAULT_USER_ACCOUNTS, ...DEMO_EMPLOYER_ACCOUNTS]
        .filter(a => a.role === 'EMPLOYER')
        .map(a => [a.organization, a.id])
    );
    const now = Date.now();
    const HOUR = 3600 * 1000;
    for (const [i, req] of INITIAL_VERIFICATION_REQUESTS.entries()) {
      const employerUid = employerByOrg.get(req.employerName);
      if (!employerUid) continue;
      const stillOpen = ['PENDING_STUDENT_CONSENT', 'CONSENT_GRANTED', 'VERIFYING', 'VERIFIED'].includes(req.status);
      const requestedAt = now - (2 + i * 24) * HOUR;
      await insertRequest(
        {
          ...req,
          requestedAt: new Date(requestedAt).toISOString(),
          consentGrantedAt: req.consentGrantedAt ? new Date(requestedAt + HOUR).toISOString() : undefined,
          consentRevokedAt: req.consentRevokedAt ? new Date(requestedAt + 2 * HOUR).toISOString() : undefined,
          consentExpiresAt: new Date(stillOpen ? now + 72 * HOUR : requestedAt + 24 * HOUR).toISOString(),
        },
        employerUid
      );
    }

    for (const log of INITIAL_AUDIT_LOGS) {
      await insertAuditLog(log, null);
    }
    saveToDiskStore();
    return true;
  }

  for (const acc of [...DEFAULT_USER_ACCOUNTS, ...DEMO_EMPLOYER_ACCOUNTS]) {
    const values = {
      uid: acc.id,
      name: acc.name,
      email: acc.email.toLowerCase(),
      role: acc.role,
      organization: acc.organization,
      designation: acc.designation || '',
      phone: acc.phone || '',
      apaarId: acc.apaarId || null,
      authProvider: 'password',
      isSeed: true,
      institutionApproved: true,
    };
    try {
      const { uid: _uid, ...updatable } = values;
      await db.insert(users).values(values).onConflictDoUpdate({ target: users.uid, set: updatable });
    } catch (err) {
      console.warn(`[db] Demo account ${acc.email} not created (email already used by another account).`);
    }
  }

  const existing = await db.execute(sql`SELECT count(*)::int AS n FROM students`);
  const count = Number((existing as any).rows?.[0]?.n ?? 0);
  if (count > 0) return false;

  const seedInstitutionUid = 'user-inst-annauniv';

  for (const student of generateFullStudentRegistry()) {
    await db
      .insert(students)
      .values({
        apaarId: student.apaarId,
        pen: student.pen,
        name: student.name,
        dob: student.dob,
        gender: student.gender,
        currentInstitution: student.currentInstitution,
        stage: student.stage,
        district: student.district,
        status: student.status,
        consentPending: student.consentPending,
        hasDigilockerAccount: student.hasDigilockerAccount,
        digilockerDocumentsCount: student.digilockerDocumentsCount,
        abcCreditsBalance: student.abcCreditsBalance,
        contactEmail: student.contactEmail,
        contactPhone: student.contactPhone,
        createdByUid: seedInstitutionUid,
      })
      .onConflictDoNothing();
    await insertCredentials(
      student.apaarId,
      student.credentials.map(c =>
        signCredential({
          ...c,
          digilockerUri: ensureVaultUri(c.digilockerUri, student.apaarId, c.id, c.type),
        })
      )
    );
  }

  const employerByOrg = new Map(
    [...DEFAULT_USER_ACCOUNTS, ...DEMO_EMPLOYER_ACCOUNTS]
      .filter(a => a.role === 'EMPLOYER')
      .map(a => [a.organization, a.id])
  );
  const now = Date.now();
  const HOUR = 3600 * 1000;
  for (const [i, req] of INITIAL_VERIFICATION_REQUESTS.entries()) {
    const employerUid = employerByOrg.get(req.employerName);
    if (!employerUid) continue;
    const stillOpen = ['PENDING_STUDENT_CONSENT', 'CONSENT_GRANTED', 'VERIFYING', 'VERIFIED'].includes(req.status);
    const requestedAt = now - (2 + i * 24) * HOUR;
    await insertRequest(
      {
        ...req,
        requestedAt: new Date(requestedAt).toISOString(),
        consentGrantedAt: req.consentGrantedAt ? new Date(requestedAt + HOUR).toISOString() : undefined,
        consentRevokedAt: req.consentRevokedAt ? new Date(requestedAt + 2 * HOUR).toISOString() : undefined,
        consentExpiresAt: new Date(stillOpen ? now + 72 * HOUR : requestedAt + 24 * HOUR).toISOString(),
      },
      employerUid
    );
  }
  return true;
}
