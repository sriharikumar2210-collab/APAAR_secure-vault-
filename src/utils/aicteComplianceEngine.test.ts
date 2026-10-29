/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidApaarFormat,
  calculateStudentAge,
  computeInstitutionSeatMetrics,
  validateAdmissionBatch,
  INITIAL_INSTITUTION_INTAKES,
  AdmissionUploadRecord,
} from './aicteComplianceEngine';
import { generateFullStudentRegistry } from '../data/mockData';

test('isValidApaarFormat validates 12-digit APAAR numbers', () => {
  assert.equal(isValidApaarFormat('2990 9583 2586'), true);
  assert.equal(isValidApaarFormat('481290347721'), true);
  assert.equal(isValidApaarFormat('0990 9583 2586'), false); // starts with 0
  assert.equal(isValidApaarFormat('2990 9583'), false); // too short
  assert.equal(isValidApaarFormat('ABCD 9583 2586'), false); // non-numeric
});

test('calculateStudentAge computes accurate age for programme checks', () => {
  assert.equal(calculateStudentAge('2004-05-15', 2026), 22);
  assert.equal(calculateStudentAge('2015-01-10', 2026), 11);
  assert.equal(calculateStudentAge('invalid-date', 2026), null);
});

test('computeInstitutionSeatMetrics calculates intake vs actual + supernumerary seats', () => {
  const sample = INITIAL_INSTITUTION_INTAKES[0];
  const metrics = computeInstitutionSeatMetrics(sample);
  assert.equal(metrics.totalActualAdmissions, 112 + 6 + 4 + 5 + 14);
  assert.equal(metrics.totalPermittedCeiling, 120 + 18 + 18);
  assert.equal(metrics.isExcessAdmission, false);
});

test('validateAdmissionBatch catches all 5 expected AICTE validation rules', () => {
  const existingStudents = generateFullStudentRegistry();

  const testBatch: AdmissionUploadRecord[] = [
    // Rule 1: Duplicate within the same institution (Abinaya S is already at Anna University or let's duplicate in batch)
    {
      apaarId: '7123 4567 8901',
      studentId: 'AU-2026-101',
      name: 'Karthik M',
      dob: '2004-06-12',
      gender: 'Male',
      institutionName: 'Anna University, Guindy Campus, Chennai',
      aicteInstitutionCode: '1-4092817291',
      programmeStage: 'UG',
      department: 'B.Tech Information Technology',
      quotaCategory: 'GENERAL_MERIT',
      nationality: 'Indian',
      domesticCategory: 'OBC',
      status: 'Active',
    },
    {
      apaarId: '7123 4567 8901', // Duplicate in same institution!
      studentId: 'AU-2026-102',
      name: 'Karthik M Duplicate',
      dob: '2004-06-12',
      gender: 'Male',
      institutionName: 'Anna University, Guindy Campus, Chennai',
      aicteInstitutionCode: '1-4092817291',
      programmeStage: 'UG',
      department: 'B.Tech Information Technology',
      quotaCategory: 'GENERAL_MERIT',
      nationality: 'Indian',
      domesticCategory: 'OBC',
      status: 'Active',
    },
    // Rule 2: Invalid or missing APAAR ID
    {
      apaarId: '9912-INVALID',
      studentId: 'AU-2026-103',
      name: 'Meena R',
      dob: '2005-03-19',
      gender: 'Female',
      institutionName: 'PSG College of Technology, Coimbatore',
      aicteInstitutionCode: '1-3819204112',
      programmeStage: 'UG',
      department: 'B.E. Computer Science',
      quotaCategory: 'GENERAL_MERIT',
      nationality: 'Indian',
      domesticCategory: 'OPEN',
      status: 'Active',
    },
    // Rule 4: Inconsistent data (Foreign National in Indian SC category + PG student age 15)
    {
      apaarId: '8234 5678 9012',
      studentId: 'NIT-2026-401',
      name: 'Liam O Connor',
      dob: '2012-08-01', // 14 years old in PG!
      gender: 'Male',
      institutionName: 'NIT Tiruchirappalli',
      aicteInstitutionCode: '1-2940182931',
      programmeStage: 'PG',
      department: 'M.Tech Data Science',
      quotaCategory: 'FOREIGN_NATIONAL',
      nationality: 'Foreign National',
      domesticCategory: 'SC', // Foreign national in Indian reserved category!
      status: 'Active',
    },
    // Rule 5: Cross-institution duplicate (Active in another institution compared to existing registry student)
    {
      apaarId: existingStudents[0].apaarId,
      studentId: 'TCE-2026-881',
      name: existingStudents[0].name,
      dob: '2004-04-10',
      gender: 'Female',
      institutionName: 'New Sovereign Engineering College, Salem',
      aicteInstitutionCode: '1-9988776655',
      programmeStage: 'UG',
      department: 'B.E. Electronics',
      quotaCategory: 'GENERAL_MERIT',
      nationality: 'Indian',
      domesticCategory: 'OPEN',
      status: 'Active',
    },
  ];

  // Also trigger Rule 3 (Excess Admission) by passing an institution over its intake + supernumerary cap
  const overloadedQuotas = [
    {
      ...INITIAL_INSTITUTION_INTAKES[0],
      actualGeneralAdmissions: 155, // Pushes total over 156 ceiling when batch adds 2 records
    },
  ];

  const report = validateAdmissionBatch(testBatch, existingStudents, overloadedQuotas);

  assert.equal(report.isValid, false);
  assert.equal(report.ruleSummary.DUPLICATE_IN_INSTITUTION.status, 'FLAGGED');
  assert.equal(report.ruleSummary.INVALID_OR_MISSING_APAAR.status, 'FLAGGED');
  assert.equal(report.ruleSummary.EXCESS_ADMISSION.status, 'FLAGGED');
  assert.equal(report.ruleSummary.INCONSISTENT_DATA.status, 'FLAGGED');
  assert.equal(report.ruleSummary.CROSS_INSTITUTION_DUPLICATE.status, 'FLAGGED');
});
