/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Caller,
  StoredStudent,
  StoredRequest,
  filterStudentsForCaller,
  filterRequestsForCaller,
  canWriteStudent,
  canChangeRequestStatus,
  canVerifyRequest,
  canReceiveEvent,
} from './accessRules.ts';

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

const callers: Record<string, Caller> = {
  student: { uid: 'u-stu', role: 'STUDENT', email: 's@x', name: 'Abinaya', organization: 'GCT', apaarId: '2990 9583 2586' },
  otherStudent: { uid: 'u-stu2', role: 'STUDENT', email: 's2@x', name: 'Other', organization: 'X', apaarId: '1111 2222 3333' },
  employer: { uid: 'u-emp', role: 'EMPLOYER', email: 'e@x', name: 'HR', organization: 'TCS' },
  otherEmployer: { uid: 'u-emp2', role: 'EMPLOYER', email: 'e2@x', name: 'HR2', organization: 'TCS' },
  institution: { uid: 'u-inst', role: 'INSTITUTION', email: 'i@x', name: 'Reg', organization: 'Anna Univ' },
  otherInstitution: { uid: 'u-inst2', role: 'INSTITUTION', email: 'i2@x', name: 'Fake', organization: 'Anna Univ' },
  regulator: { uid: 'u-reg', role: 'REGULATOR', email: 'r@x', name: 'Aud', organization: 'MoE' },
};

const student: StoredStudent = {
  apaarId: '2990 9583 2586', pen: '1', name: 'Abinaya S', dob: '2002-01-01', gender: 'Female',
  currentInstitution: 'GCT', stage: 'Graduated', district: 'Salem', status: 'Graduated', aadhaarMismatch: false,
  consentPending: false, hasDigilockerAccount: true, digilockerDocumentsCount: 2, abcCreditsBalance: 100,
  credentials: [
    { id: 'C1', type: 'DEGREE', title: 'B.Tech', issuingInstitution: 'GCT', issuingAuthority: 'AU', yearOfPassing: 2024, cgpaOrPercentage: '8.8', specialization: 'IT', digilockerUri: '', aicteApprovalNumber: 'A', sha256Hash: 'h', digitalSignature: 's', issuerCertificateSerial: 'x', timestamp: '' },
    { id: 'C2', type: 'MARKSHEET', title: 'Marks', issuingInstitution: 'GCT', issuingAuthority: 'AU', yearOfPassing: 2024, cgpaOrPercentage: '8.8', specialization: 'IT', digilockerUri: '', aicteApprovalNumber: 'A', sha256Hash: 'h', digitalSignature: 's', issuerCertificateSerial: 'x', timestamp: '' },
  ],
  contactEmail: 'a@example.com', contactPhone: '+91 90000 00002', createdByUid: 'u-inst',
};

const request = (over: Partial<StoredRequest> = {}): StoredRequest => ({
  id: 'R1', employerId: 'u-emp', employerName: 'TCS', verifierName: 'HR', verifierRole: 'HR', verifierEmail: 'e@x',
  verifierIp: '', studentApaarId: '2990 9583 2586', studentName: 'Abinaya S', requestedCredentialTypes: ['DEGREE'],
  purpose: 'Hiring', requestedAt: past, consentExpiresAt: future, status: 'PENDING_STUDENT_CONSENT',
  scopeOfAccess: ['IDENTITY', 'ACADEMIC_MARKS'], auditTrailId: 'A-R1', employerUid: 'u-emp', ...over,
});

describe('Reads are filtered by role and ownership', () => {
  it('employer without consent sees no credentials or contact details', () => {
    const [s] = filterStudentsForCaller([student], [request()], callers.employer);
    assert.equal(s.credentials.length, 0);
    assert.equal(s.contactEmail, '');
    assert.equal(s.contactPhone, '');
  });

  it('employer with active consent sees only the requested credential types', () => {
    const [s] = filterStudentsForCaller([student], [request({ status: 'CONSENT_GRANTED' })], callers.employer);
    assert.deepEqual(s.credentials.map(c => c.type), ['DEGREE']);
    assert.equal(s.contactPhone, '', 'contact details are never shared with employers');
  });

  it('expired consent no longer shows credentials', () => {
    const [s] = filterStudentsForCaller([student], [request({ status: 'VERIFIED', consentExpiresAt: past })], callers.employer);
    assert.equal(s.credentials.length, 0);
  });

  it('employers see nothing about students they have no request for', () => {
    assert.equal(filterStudentsForCaller([student], [request()], callers.otherEmployer).length, 0);
  });

  it('students see only themselves; institutions only students they registered', () => {
    assert.equal(filterStudentsForCaller([student], [], callers.student).length, 1);
    assert.equal(filterStudentsForCaller([student], [], callers.otherStudent).length, 0);
    assert.equal(filterStudentsForCaller([student], [], callers.institution).length, 1);
    assert.equal(filterStudentsForCaller([student], [], callers.otherInstitution).length, 0);
    assert.equal(filterStudentsForCaller([student], [], callers.regulator).length, 1);
  });

  it('requests are visible only to the student, the owning employer, the registering institution and the regulator', () => {
    const r = [request()];
    assert.equal(filterRequestsForCaller(r, [student], callers.student).length, 1);
    assert.equal(filterRequestsForCaller(r, [student], callers.employer).length, 1);
    assert.equal(filterRequestsForCaller(r, [student], callers.institution).length, 1);
    assert.equal(filterRequestsForCaller(r, [student], callers.regulator).length, 1);
    assert.equal(filterRequestsForCaller(r, [student], callers.otherStudent).length, 0);
    assert.equal(filterRequestsForCaller(r, [student], callers.otherEmployer).length, 0);
    assert.equal(filterRequestsForCaller(r, [student], callers.otherInstitution).length, 0);
  });
});

describe('Writes check ownership', () => {
  it('only the registering institution (or regulator) can change a student', () => {
    assert.equal(canWriteStudent(callers.institution, student, student).ok, true);
    assert.equal(canWriteStudent(callers.otherInstitution, student, student).ok, false);
    assert.equal(canWriteStudent(callers.employer, student, student).ok, false);
    assert.equal(canWriteStudent(callers.otherStudent, student, student).ok, false);
    assert.equal(canWriteStudent(callers.student, student, student).ok, true);
    assert.equal(canWriteStudent(callers.regulator, student, student).ok, true);
  });

  it('blocks unapproved self-registered institutions from registering or editing students until Regulator approves', () => {
    const unapprovedInst: Caller = { ...callers.institution, institutionApproved: false };
    const approvedInst: Caller = { ...callers.institution, institutionApproved: true };
    const denied = canWriteStudent(unapprovedInst, null, student);
    assert.equal(denied.ok, false);
    assert.equal(canWriteStudent(approvedInst, null, student).ok, true);
  });

  it('only the named student can grant, reject or revoke consent', () => {
    assert.equal(canChangeRequestStatus(callers.student, request(), 'CONSENT_GRANTED').ok, true);
    assert.equal(canChangeRequestStatus(callers.otherStudent, request(), 'CONSENT_GRANTED').ok, false);
    assert.equal(canChangeRequestStatus(callers.employer, request(), 'CONSENT_GRANTED').ok, false);
    assert.equal(canChangeRequestStatus(callers.institution, request(), 'CONSENT_GRANTED').ok, false);
    assert.equal(canChangeRequestStatus(callers.regulator, request(), 'CONSENT_GRANTED').ok, false);
  });

  it('nobody can set verification results through a status change', () => {
    for (const c of Object.values(callers)) {
      assert.equal(canChangeRequestStatus(c, request({ status: 'CONSENT_GRANTED' }), 'VERIFIED').ok, false);
    }
  });

  it('status changes must follow the request lifecycle and expiry', () => {
    const d = canChangeRequestStatus(callers.student, request({ status: 'CONSENT_REVOKED' }), 'CONSENT_GRANTED');
    assert.equal(d.ok, false);
    const expired = canChangeRequestStatus(callers.student, request({ consentExpiresAt: past }), 'CONSENT_GRANTED');
    assert.equal(expired.ok, false);
  });

  it('verification needs active consent and the owning employer', () => {
    assert.equal(canVerifyRequest(callers.employer, request()).ok, false, 'no consent yet');
    assert.equal(canVerifyRequest(callers.employer, request({ status: 'CONSENT_GRANTED' })).ok, true);
    assert.equal(canVerifyRequest(callers.otherEmployer, request({ status: 'CONSENT_GRANTED' })).ok, false);
    assert.equal(canVerifyRequest(callers.employer, request({ status: 'CONSENT_GRANTED', consentExpiresAt: past })).ok, false);
  });
});

describe('Live updates go only to the right people', () => {
  const ctx = { studentApaarId: '2990 9583 2586', employerUid: 'u-emp', studentCreatedBy: 'u-inst' };
  it('request events', () => {
    assert.equal(canReceiveEvent('request:upserted', callers.student, ctx), true);
    assert.equal(canReceiveEvent('request:upserted', callers.employer, ctx), true);
    assert.equal(canReceiveEvent('request:upserted', callers.otherStudent, ctx), false);
    assert.equal(canReceiveEvent('request:upserted', callers.otherEmployer, ctx), false);
  });
  it('student record events never go to employers', () => {
    assert.equal(canReceiveEvent('student:upserted', callers.employer, ctx), false);
    assert.equal(canReceiveEvent('student:upserted', callers.institution, ctx), true);
    assert.equal(canReceiveEvent('student:upserted', callers.otherInstitution, ctx), false);
  });
});
