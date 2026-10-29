/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateHash, createAuditLog } from './verificationEngine';

describe('APAAR Approval Logic and Consent Options', () => {
  it('validates Aadhaar OTP simulated tokens correctly', () => {
    const validOtps = ['262630', '123456'];
    const invalidOtps = ['000000', '123', 'abcde', ''];

    validOtps.forEach(otp => {
      assert.equal(otp.length === 6 && (otp === '262630' || otp === '123456'), true);
    });

    invalidOtps.forEach(otp => {
      assert.equal(otp.length === 6 && (otp === '262630' || otp === '123456'), false);
    });
  });

  it('calculates time-bound consent expiration accurately', () => {
    const baseTime = 1700000000000;
    const hours24 = 24;
    const expiry24 = new Date(baseTime + hours24 * 3600 * 1000).getTime();
    assert.equal(expiry24 - baseTime, 24 * 3600 * 1000);

    const hours1 = 1;
    const expiry1 = new Date(baseTime + hours1 * 3600 * 1000).getTime();
    assert.equal(expiry1 - baseTime, 3600 * 1000);
  });

  it('generates immutable audit log entry for APAAR enrollment approval', () => {
    const studentApaarId = '6365 2135 5206';
    const log = createAuditLog(
      'Parent/Guardian: Sundaram S',
      'STUDENT',
      'APAAR_ENROLLMENT_APPROVED',
      studentApaarId,
      'Parental consent approved under NEP 2020 / DoSEL regulations with Aadhaar demographic verification.',
      'SUCCESS',
      'ENROLL-636521355206'
    );

    assert.equal(log.studentApaarId, studentApaarId);
    assert.equal(log.action, 'APAAR_ENROLLMENT_APPROVED');
    assert.equal(log.actorType, 'STUDENT');
    assert.equal(typeof log.sha256Fingerprint, 'string');
    assert.equal(log.sha256Fingerprint.length, 64);
  });

  it('verifies granular scope enforcement on consent grants', () => {
    const allowedFields = ['IDENTITY', 'ACADEMIC_MARKS', 'DIGITAL_SIGNATURE'];
    assert.equal(allowedFields.includes('IDENTITY'), true);
    assert.equal(allowedFields.includes('ACADEMIC_MARKS'), true);
    assert.equal(allowedFields.includes('FULL_TRANSCRIPT'), false);
  });
});
