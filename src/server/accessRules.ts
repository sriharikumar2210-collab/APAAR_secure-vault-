/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side access rules. Every decision about who may read or change a record is
 * made here, from the caller's database record — never from what the browser sends.
 */

import type { Student, VerificationRequest, AuditLogEntry, VerificationStatus } from '../types/index.ts';
import { transitionRequestStatus } from '../utils/verificationEngine.ts';

export type Role = 'STUDENT' | 'EMPLOYER' | 'INSTITUTION' | 'REGULATOR';

export interface Caller {
  uid: string;
  role: Role;
  email: string;
  name: string;
  organization: string;
  apaarId?: string | null;
  institutionApproved?: boolean;
}

/** Server-side extra fields that never come from the browser. */
export type StoredStudent = Student & { createdByUid?: string | null };
export type StoredRequest = VerificationRequest & { employerUid?: string | null };
export type StoredAuditLog = AuditLogEntry & { actorUid?: string | null };

export type Decision = { ok: true } | { ok: false; status: 400 | 403 | 404 | 409; error: string };

const allow: Decision = { ok: true };
const deny = (status: 400 | 403 | 404 | 409, error: string): Decision => ({ ok: false, status, error });

export function digitsOnly(apaarId: string | null | undefined): string {
  return String(apaarId || '').replace(/\D/g, '');
}

export function sameApaar(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = digitsOnly(a);
  return x.length === 12 && x === digitsOnly(b);
}

export function isConsentActive(req: VerificationRequest, now = Date.now()): boolean {
  if (req.status !== 'CONSENT_GRANTED' && req.status !== 'VERIFYING' && req.status !== 'VERIFIED') {
    return false;
  }
  const expiry = Date.parse(req.consentExpiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function redactForEmployer(student: StoredStudent, activeConsents: StoredRequest[]): Student {
  const { createdByUid: _omit, ...publicStudent } = student;
  const allowedTypes = new Set(activeConsents.flatMap(r => r.requestedCredentialTypes));
  const canSeeMarks = activeConsents.some(r =>
    r.scopeOfAccess.some(s => s === 'ACADEMIC_MARKS' || s === 'FULL_TRANSCRIPT' || s === 'DIGITAL_SIGNATURE')
  );
  return {
    ...publicStudent,
    dob: activeConsents.length > 0 ? student.dob : '',
    contactEmail: '',
    contactPhone: '',
    credentials: canSeeMarks ? student.credentials.filter(c => allowedTypes.has(c.type)) : [],
  };
}

function stripServerFields(student: StoredStudent): Student {
  const { createdByUid: _omit, ...rest } = student;
  return rest;
}

/**
 * - REGULATOR: every student.
 * - INSTITUTION: students it registered.
 * - STUDENT: only their own record.
 * - EMPLOYER: only students it has a request for; contact details hidden, and
 *   credentials only while consent is active, limited to the requested types.
 */
export function filterStudentsForCaller(
  students: StoredStudent[],
  requests: StoredRequest[],
  caller: Caller,
  now = Date.now()
): Student[] {
  switch (caller.role) {
    case 'REGULATOR':
      return students.map(stripServerFields);
    case 'INSTITUTION':
      return students.filter(s => s.createdByUid === caller.uid).map(stripServerFields);
    case 'STUDENT':
      return students.filter(s => sameApaar(s.apaarId, caller.apaarId)).map(stripServerFields);
    case 'EMPLOYER': {
      const mine = requests.filter(r => r.employerUid === caller.uid);
      return students
        .filter(s => mine.some(r => sameApaar(r.studentApaarId, s.apaarId)))
        .map(s =>
          redactForEmployer(
            s,
            mine.filter(r => sameApaar(r.studentApaarId, s.apaarId) && isConsentActive(r, now))
          )
        );
    }
    default:
      return [];
  }
}

export function canSeeRequest(
  req: StoredRequest,
  caller: Caller,
  studentCreatedBy?: string | null
): boolean {
  switch (caller.role) {
    case 'REGULATOR':
      return true;
    case 'EMPLOYER':
      return req.employerUid === caller.uid;
    case 'STUDENT':
      return sameApaar(req.studentApaarId, caller.apaarId);
    case 'INSTITUTION':
      return !!studentCreatedBy && studentCreatedBy === caller.uid;
    default:
      return false;
  }
}

export function toPublicRequest(req: StoredRequest): VerificationRequest {
  const { employerUid: _omit, ...rest } = req;
  return rest;
}

export function filterRequestsForCaller(
  requests: StoredRequest[],
  students: StoredStudent[],
  caller: Caller
): VerificationRequest[] {
  const createdBy = new Map(students.map(s => [digitsOnly(s.apaarId), s.createdByUid || null]));
  return requests
    .filter(r => canSeeRequest(r, caller, createdBy.get(digitsOnly(r.studentApaarId))))
    .map(toPublicRequest);
}

export function canSeeAuditLog(
  log: StoredAuditLog,
  caller: Caller,
  ctx: { requestEmployerUid?: string | null; studentCreatedBy?: string | null }
): boolean {
  if (caller.role === 'REGULATOR') return true;
  if (log.actorUid && log.actorUid === caller.uid) return true;
  switch (caller.role) {
    case 'STUDENT':
      return sameApaar(log.studentApaarId, caller.apaarId);
    case 'EMPLOYER':
      return !!ctx.requestEmployerUid && ctx.requestEmployerUid === caller.uid;
    case 'INSTITUTION':
      return !!ctx.studentCreatedBy && ctx.studentCreatedBy === caller.uid;
    default:
      return false;
  }
}

export function toPublicAuditLog(log: StoredAuditLog): AuditLogEntry {
  const { actorUid: _omit, ...rest } = log;
  return rest;
}

export function filterAuditLogsForCaller(
  logs: StoredAuditLog[],
  requests: StoredRequest[],
  students: StoredStudent[],
  caller: Caller
): AuditLogEntry[] {
  const requestEmployer = new Map(requests.map(r => [r.id, r.employerUid || null]));
  const createdBy = new Map(students.map(s => [digitsOnly(s.apaarId), s.createdByUid || null]));
  return logs
    .filter(l =>
      canSeeAuditLog(l, caller, {
        requestEmployerUid: l.requestId ? requestEmployer.get(l.requestId) : null,
        studentCreatedBy: createdBy.get(digitsOnly(l.studentApaarId)),
      })
    )
    .map(toPublicAuditLog);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Who may create or update a student record. */
export function canWriteStudent(
  caller: Caller,
  existing: StoredStudent | null,
  incoming: Partial<Student>
): Decision {
  if (!incoming || digitsOnly(incoming.apaarId).length !== 12) {
    return deny(400, 'A valid 12-digit APAAR ID is required.');
  }
  switch (caller.role) {
    case 'REGULATOR':
      return allow;
    case 'INSTITUTION':
      if (caller.institutionApproved === false) {
        return deny(403, 'Institution account is pending Regulator approval before it can register or update students.');
      }
      if (existing && existing.createdByUid !== caller.uid) {
        return deny(403, 'This student is registered by another institution.');
      }
      return allow;
    case 'STUDENT':
      if (!sameApaar(incoming.apaarId, caller.apaarId)) {
        return deny(403, 'Students can only change their own record.');
      }
      return allow;
    default:
      return deny(403, 'Employers cannot create or change student records.');
  }
}

const CONSENT_STATUSES: VerificationStatus[] = ['CONSENT_GRANTED', 'CONSENT_REJECTED', 'CONSENT_REVOKED'];
const VERIFICATION_STATUSES: VerificationStatus[] = ['VERIFYING', 'VERIFIED', 'TAMPERED_FAILED'];

/**
 * Status changes sent through PATCH /api/db/requests/:id.
 * - Consent decisions: only the student named on the request.
 * - Verification results: never through PATCH — only the server's own verify endpoint sets them.
 * - Every change must follow the request lifecycle.
 */
export function canChangeRequestStatus(
  caller: Caller,
  existing: StoredRequest,
  target: VerificationStatus,
  now = Date.now()
): Decision {
  if (VERIFICATION_STATUSES.includes(target)) {
    return deny(403, 'Verification results are set by the server verification step, not by clients.');
  }
  if (!CONSENT_STATUSES.includes(target)) {
    return deny(400, `Unknown or unsupported status: ${target}`);
  }
  if (caller.role !== 'STUDENT' || !sameApaar(existing.studentApaarId, caller.apaarId)) {
    return deny(403, 'Only the student named on this request can grant, reject or revoke consent.');
  }
  const transition = transitionRequestStatus(existing.status, target);
  if (!transition.allowed) {
    return deny(409, transition.error || 'Status change not allowed.');
  }
  if (target === 'CONSENT_GRANTED') {
    const expiry = Date.parse(existing.consentExpiresAt);
    if (Number.isFinite(expiry) && expiry < now) {
      return deny(409, 'This request has expired and can no longer be approved.');
    }
  }
  return allow;
}

/** Who may run the server-side credential verification for a request. */
export function canVerifyRequest(caller: Caller, existing: StoredRequest, now = Date.now()): Decision {
  const isOwner = caller.role === 'EMPLOYER' && existing.employerUid === caller.uid;
  if (!isOwner && caller.role !== 'REGULATOR') {
    return deny(403, 'Only the employer who made this request can run verification.');
  }
  if (existing.status !== 'CONSENT_GRANTED' && existing.status !== 'VERIFYING') {
    return deny(409, `Verification needs active student consent. Current status: ${existing.status}.`);
  }
  if (!isConsentActive(existing, now)) {
    return deny(409, 'The student consent window has expired.');
  }
  return allow;
}

// ---------------------------------------------------------------------------
// Live updates: decide which connected users receive which event.
// ---------------------------------------------------------------------------

export interface EventContext {
  studentApaarId?: string | null;
  employerUid?: string | null;
  studentCreatedBy?: string | null;
  actorUid?: string | null;
  subjectUid?: string | null;
}

export function canReceiveEvent(type: string, caller: Caller, ctx: EventContext): boolean {
  if (type === 'connected' || type === 'presence:update') return true;
  if (caller.role === 'REGULATOR') return true;
  const isStudentSubject = caller.role === 'STUDENT' && sameApaar(ctx.studentApaarId, caller.apaarId);
  const isEmployerOwner = caller.role === 'EMPLOYER' && !!ctx.employerUid && ctx.employerUid === caller.uid;
  const isInstitutionOwner =
    caller.role === 'INSTITUTION' && !!ctx.studentCreatedBy && ctx.studentCreatedBy === caller.uid;

  switch (type) {
    case 'student:upserted':
      return isStudentSubject || isInstitutionOwner;
    case 'request:upserted':
    case 'alert:dispatched':
      return isStudentSubject || isEmployerOwner || isInstitutionOwner;
    case 'audit:created':
      return (
        (!!ctx.actorUid && ctx.actorUid === caller.uid) ||
        isStudentSubject ||
        isEmployerOwner ||
        isInstitutionOwner
      );
    case 'user:synced':
      return !!ctx.subjectUid && ctx.subjectUid === caller.uid;
    default:
      return false;
  }
}
