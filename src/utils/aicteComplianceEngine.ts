/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, EducationStage } from '../types';

export type AdmissionQuotaCategory =
  | 'GENERAL_MERIT'
  | 'NRI'
  | 'OCI'
  | 'FOREIGN_NATIONAL'
  | 'SUPERNUMERARY_TFW'
  | 'SUPERNUMERARY_PMSSS'
  | 'DOMESTIC_RESERVED';

export type DomesticReservationCategory = 'OPEN' | 'OBC' | 'SC' | 'ST' | 'EWS' | 'NONE_FOREIGN';

export interface AdmissionUploadRecord {
  rowNumber?: number;
  apaarId: string;
  studentId: string; // University Roll No / PEN
  name: string;
  dob: string; // YYYY-MM-DD
  gender: 'Female' | 'Male' | 'Other';
  institutionName: string;
  aicteInstitutionCode: string;
  programmeStage: EducationStage;
  department: string;
  quotaCategory: AdmissionQuotaCategory;
  nationality: 'Indian' | 'Foreign National' | 'OCI' | 'NRI';
  domesticCategory: DomesticReservationCategory;
  status: 'Active' | 'Graduated' | 'Dropped out';
}

export interface InstitutionIntakeQuota {
  institutionName: string;
  aicteCode: string;
  district: string;
  approvedIntake: number;
  permittedSupernumerarySeats: number; // TFW (5%) + PMSSS + EWS supernumerary
  permittedNriOciFnSeats: number; // Up to 15% AICTE Foreign/OCI/NRI ceiling
  actualGeneralAdmissions: number;
  nriAdmissions: number;
  ociAdmissions: number;
  foreignNationalAdmissions: number;
  supernumeraryAdmissions: number;
  aictePortalSyncedAt: string;
}

export type ValidationRuleCode =
  | 'DUPLICATE_IN_INSTITUTION'
  | 'INVALID_OR_MISSING_APAAR'
  | 'EXCESS_ADMISSION'
  | 'INCONSISTENT_DATA'
  | 'CROSS_INSTITUTION_DUPLICATE';

export interface ValidationIssue {
  ruleNumber: 1 | 2 | 3 | 4 | 5;
  code: ValidationRuleCode;
  title: string;
  severity: 'ERROR' | 'WARNING';
  apaarId: string;
  studentName: string;
  institutionName: string;
  explanation: string;
}

export interface ValidationReport {
  isValid: boolean;
  totalChecked: number;
  passedCount: number;
  failedCount: number;
  issues: ValidationIssue[];
  ruleSummary: Record<
    ValidationRuleCode,
    {
      ruleNumber: 1 | 2 | 3 | 4 | 5;
      label: string;
      description: string;
      violationCount: number;
      status: 'PASS' | 'FLAGGED';
    }
  >;
}

export const INITIAL_INSTITUTION_INTAKES: InstitutionIntakeQuota[] = [
  {
    institutionName: 'Anna University, Guindy Campus, Chennai',
    aicteCode: '1-4092817291',
    district: 'Chennai',
    approvedIntake: 120,
    permittedSupernumerarySeats: 18,
    permittedNriOciFnSeats: 18,
    actualGeneralAdmissions: 112,
    nriAdmissions: 6,
    ociAdmissions: 4,
    foreignNationalAdmissions: 5,
    supernumeraryAdmissions: 14,
    aictePortalSyncedAt: '2026-10-27T04:30:00Z',
  },
  {
    institutionName: 'PSG College of Technology, Coimbatore',
    aicteCode: '1-3819204112',
    district: 'Coimbatore',
    approvedIntake: 180,
    permittedSupernumerarySeats: 27,
    permittedNriOciFnSeats: 27,
    actualGeneralAdmissions: 174,
    nriAdmissions: 9,
    ociAdmissions: 5,
    foreignNationalAdmissions: 6,
    supernumeraryAdmissions: 22,
    aictePortalSyncedAt: '2026-10-27T04:30:00Z',
  },
  {
    institutionName: 'NIT Tiruchirappalli',
    aicteCode: '1-2940182931',
    district: 'Tiruchirappalli',
    approvedIntake: 150,
    permittedSupernumerarySeats: 22,
    permittedNriOciFnSeats: 22,
    actualGeneralAdmissions: 145,
    nriAdmissions: 7,
    ociAdmissions: 6,
    foreignNationalAdmissions: 8,
    supernumeraryAdmissions: 19,
    aictePortalSyncedAt: '2026-10-27T04:30:00Z',
  },
  {
    institutionName: 'Thiagarajar College of Engineering, Madurai',
    aicteCode: '1-5192038475',
    district: 'Madurai',
    approvedIntake: 120,
    permittedSupernumerarySeats: 18,
    permittedNriOciFnSeats: 18,
    actualGeneralAdmissions: 118,
    nriAdmissions: 4,
    ociAdmissions: 2,
    foreignNationalAdmissions: 3,
    supernumeraryAdmissions: 16,
    aictePortalSyncedAt: '2026-10-27T04:30:00Z',
  },
];

/**
 * Normalizes a 12-digit APAAR ID string by stripping spaces and hyphens
 */
export function normalizeApaarDigits(raw: string): string {
  return (raw || '').replace(/[\s-]/g, '');
}

/**
 * Checks if an APAAR ID has a valid 12-digit numeric format (first digit 1-9)
 */
export function isValidApaarFormat(raw: string): boolean {
  const digits = normalizeApaarDigits(raw);
  return /^[1-9]\d{11}$/.test(digits);
}

/**
 * Calculates age in years from YYYY-MM-DD birth date relative to reference year (default 2026)
 */
export function calculateStudentAge(dob: string, referenceYear = 2026): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) return null;
  const birthYear = parseInt(dob.trim().slice(0, 4), 10);
  if (Number.isNaN(birthYear) || birthYear < 1940 || birthYear > referenceYear) return null;
  return referenceYear - birthYear;
}

/**
 * Computes total actual admissions and maximum permitted seats for an institution
 */
export function computeInstitutionSeatMetrics(quota: InstitutionIntakeQuota) {
  const totalActualAdmissions =
    quota.actualGeneralAdmissions +
    quota.nriAdmissions +
    quota.ociAdmissions +
    quota.foreignNationalAdmissions +
    quota.supernumeraryAdmissions;

  const totalPermittedCeiling =
    quota.approvedIntake +
    quota.permittedSupernumerarySeats +
    quota.permittedNriOciFnSeats;

  const excessSeats = Math.max(0, totalActualAdmissions - totalPermittedCeiling);
  const utilizationPct =
    totalPermittedCeiling > 0
      ? Math.round((totalActualAdmissions / totalPermittedCeiling) * 1000) / 10
      : 0;

  return {
    totalActualAdmissions,
    totalPermittedCeiling,
    excessSeats,
    isExcessAdmission: excessSeats > 0,
    utilizationPct,
  };
}

/**
 * Runs all 5 AICTE Automated Validation Checks against uploaded admission records,
 * existing registry students, and institution intake limits.
 */
export function validateAdmissionBatch(
  records: AdmissionUploadRecord[],
  existingStudents: Student[],
  institutionQuotas: InstitutionIntakeQuota[]
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Track APAAR occurrences per institution and across institutions
  const institutionApaarSeen = new Map<string, Set<string>>();
  const activeInstitutionsByApaar = new Map<string, Set<string>>();

  // Seed with existing active registry students
  for (const existing of existingStudents) {
    const cleanId = normalizeApaarDigits(existing.apaarId);
    if (!cleanId) continue;
    const instKey = existing.currentInstitution.trim().toLowerCase();

    if (!institutionApaarSeen.has(instKey)) {
      institutionApaarSeen.set(instKey, new Set());
    }
    institutionApaarSeen.get(instKey)!.add(cleanId);

    if (existing.status === 'Active') {
      if (!activeInstitutionsByApaar.has(cleanId)) {
        activeInstitutionsByApaar.set(cleanId, new Set());
      }
      activeInstitutionsByApaar.get(cleanId)!.add(existing.currentInstitution.trim());
    }
  }

  // Track batch additions per institution for Rule 3 (Excess Admission)
  const batchAddedPerInstitution = new Map<string, number>();

  for (const rec of records) {
    const cleanApaar = normalizeApaarDigits(rec.apaarId);
    const instName = (rec.institutionName || 'Unspecified Institution').trim();
    const instKey = instName.toLowerCase();

    // RULE 2: Invalid or missing APAAR ID
    if (!cleanApaar || !isValidApaarFormat(cleanApaar)) {
      issues.push({
        ruleNumber: 2,
        code: 'INVALID_OR_MISSING_APAAR',
        title: 'Invalid or Missing APAAR ID',
        severity: 'ERROR',
        apaarId: rec.apaarId || '(Missing)',
        studentName: rec.name || 'Unnamed Student',
        institutionName: instName,
        explanation: !cleanApaar
          ? 'APAAR ID is missing from the uploaded admission record.'
          : `APAAR ID "${rec.apaarId}" does not match the mandatory 12-digit numeric NAD/UIDAI format.`,
      });
    } else {
      // RULE 1: Duplicate APAAR ID within the same institution
      const instSet = institutionApaarSeen.get(instKey) || new Set<string>();
      if (instSet.has(cleanApaar)) {
        issues.push({
          ruleNumber: 1,
          code: 'DUPLICATE_IN_INSTITUTION',
          title: 'Duplicate APAAR ID in Same Institution',
          severity: 'ERROR',
          apaarId: rec.apaarId,
          studentName: rec.name,
          institutionName: instName,
          explanation: `APAAR ID ${rec.apaarId} appears more than once inside ${instName}.`,
        });
      }
      instSet.add(cleanApaar);
      institutionApaarSeen.set(instKey, instSet);

      // RULE 5: Cross-institution duplicate (Active in two or more institutions)
      if (rec.status === 'Active') {
        const activeInsts = activeInstitutionsByApaar.get(cleanApaar) || new Set<string>();
        const otherInsts = Array.from(activeInsts).filter(
          i => i.toLowerCase() !== instKey
        );
        if (otherInsts.length > 0) {
          issues.push({
            ruleNumber: 5,
            code: 'CROSS_INSTITUTION_DUPLICATE',
            title: 'Cross-Institution Active Duplicate',
            severity: 'ERROR',
            apaarId: rec.apaarId,
            studentName: rec.name,
            institutionName: instName,
            explanation: `APAAR ID ${rec.apaarId} is simultaneously marked Active in ${instName} and ${otherInsts.join(', ')}.`,
          });
        }
        activeInsts.add(instName);
        activeInstitutionsByApaar.set(cleanApaar, activeInsts);
      }
    }

    // RULE 4: Inconsistent data (Foreign National / OCI in Indian reserved category, or age mismatch for programme)
    const isForeignOrOci =
      rec.nationality === 'Foreign National' ||
      rec.nationality === 'OCI' ||
      rec.quotaCategory === 'FOREIGN_NATIONAL' ||
      rec.quotaCategory === 'OCI';

    const hasIndianReservedCategory =
      rec.domesticCategory === 'SC' ||
      rec.domesticCategory === 'ST' ||
      rec.domesticCategory === 'OBC' ||
      rec.domesticCategory === 'EWS';

    if (isForeignOrOci && hasIndianReservedCategory) {
      issues.push({
        ruleNumber: 4,
        code: 'INCONSISTENT_DATA',
        title: 'Inconsistent Category / Nationality Data',
        severity: 'ERROR',
        apaarId: rec.apaarId || '(Unassigned)',
        studentName: rec.name,
        institutionName: instName,
        explanation: `Student is marked as ${rec.nationality} (${rec.quotaCategory}) but assigned Indian domestic reservation category "${rec.domesticCategory}".`,
      });
    }

    const age = calculateStudentAge(rec.dob);
    if (age !== null) {
      if ((rec.programmeStage === 'UG' || rec.programmeStage === 'Graduated') && age < 16) {
        issues.push({
          ruleNumber: 4,
          code: 'INCONSISTENT_DATA',
          title: 'Inconsistent Programme Age Eligibility',
          severity: 'ERROR',
          apaarId: rec.apaarId || '(Unassigned)',
          studentName: rec.name,
          institutionName: instName,
          explanation: `Student age (${age} yrs from DOB ${rec.dob}) does not meet minimum UG degree programme age criteria (16+ yrs).`,
        });
      } else if (rec.programmeStage === 'PG' && age < 20) {
        issues.push({
          ruleNumber: 4,
          code: 'INCONSISTENT_DATA',
          title: 'Inconsistent Programme Age Eligibility',
          severity: 'ERROR',
          apaarId: rec.apaarId || '(Unassigned)',
          studentName: rec.name,
          institutionName: instName,
          explanation: `Student age (${age} yrs from DOB ${rec.dob}) does not fit Postgraduate (PG) programme eligibility (minimum 20 yrs).`,
        });
      }
    }

    // Count new admissions per institution for Rule 3 check
    batchAddedPerInstitution.set(instKey, (batchAddedPerInstitution.get(instKey) || 0) + 1);
  }

  // RULE 3: Excess admission check across institutions
  for (const quota of institutionQuotas) {
    const instKey = quota.institutionName.trim().toLowerCase();
    const addedCount = batchAddedPerInstitution.get(instKey) || 0;
    const metrics = computeInstitutionSeatMetrics(quota);
    const projectedTotal = metrics.totalActualAdmissions + addedCount;

    if (projectedTotal > metrics.totalPermittedCeiling) {
      const excessBy = projectedTotal - metrics.totalPermittedCeiling;
      issues.push({
        ruleNumber: 3,
        code: 'EXCESS_ADMISSION',
        title: 'Excess Admission Beyond Approved Intake + Supernumerary Ceiling',
        severity: 'ERROR',
        apaarId: 'INSTITUTION_CAP',
        studentName: `${quota.institutionName} Batch`,
        institutionName: quota.institutionName,
        explanation: `Enrolment (${projectedTotal}) exceeds Approved Intake (${quota.approvedIntake}) + Permitted Supernumerary (${quota.permittedSupernumerarySeats}) + NRI/OCI/FN ceiling (${quota.permittedNriOciFnSeats}) = ${metrics.totalPermittedCeiling} by ${excessBy} seat(s).`,
      });
    }
  }

  const ruleDefinitions: Record<
    ValidationRuleCode,
    { ruleNumber: 1 | 2 | 3 | 4 | 5; label: string; description: string }
  > = {
    DUPLICATE_IN_INSTITUTION: {
      ruleNumber: 1,
      label: '1. Intra-Institution Duplicate',
      description: 'The same APAAR ID appears twice in one institution.',
    },
    INVALID_OR_MISSING_APAAR: {
      ruleNumber: 2,
      label: '2. Invalid or Missing APAAR ID',
      description: 'The 12-digit format is wrong or the ID is missing.',
    },
    EXCESS_ADMISSION: {
      ruleNumber: 3,
      label: '3. Excess Admission Cap Check',
      description: 'Enrolment exceeds approved intake plus permitted supernumerary seats.',
    },
    INCONSISTENT_DATA: {
      ruleNumber: 4,
      label: '4. Inconsistent Demographic / Category Data',
      description: 'Foreign National marked in Indian category, or age does not fit programme.',
    },
    CROSS_INSTITUTION_DUPLICATE: {
      ruleNumber: 5,
      label: '5. Cross-Institution Active Duplicate',
      description: 'The same APAAR ID is active in two or more institutions simultaneously.',
    },
  };

  const ruleSummary = {} as ValidationReport['ruleSummary'];
  (Object.keys(ruleDefinitions) as ValidationRuleCode[]).forEach(code => {
    const count = issues.filter(i => i.code === code).length;
    ruleSummary[code] = {
      ...ruleDefinitions[code],
      violationCount: count,
      status: count === 0 ? 'PASS' : 'FLAGGED',
    };
  });

  const failedRecordIds = new Set(issues.map(i => `${i.institutionName}:${i.apaarId}:${i.studentName}`));
  const failedCount = Math.min(records.length, failedRecordIds.size);
  const passedCount = Math.max(0, records.length - failedCount);

  return {
    isValid: issues.length === 0,
    totalChecked: records.length,
    passedCount,
    failedCount,
    issues,
    ruleSummary,
  };
}
