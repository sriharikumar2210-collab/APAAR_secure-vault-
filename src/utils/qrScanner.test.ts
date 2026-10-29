/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseApaarQrPayload, resolveStudentFromQr, generateApaarQrPayload } from './qrScanner';
import { Student } from '../types';

const MOCK_STUDENTS: Student[] = [
  {
    apaarId: '2990 9583 2586',
    pen: '20194817290',
    name: 'Abinaya S',
    dob: '19 Nov 2003',
    gender: 'Female',
    currentInstitution: 'Institute of Technology, Attur',
    stage: 'Graduated',
    district: 'Salem',
    status: 'Graduated',
    aadhaarMismatch: false,
    consentPending: false,
    hasDigilockerAccount: true,
    digilockerDocumentsCount: 4,
    abcCreditsBalance: 164,
    contactEmail: 'abinaya.attur@student.example.edu.in',
    contactPhone: '+91 90000 00002',
    credentials: [],
  },
  {
    apaarId: '8686 2578 1740',
    pen: '20201948194',
    name: 'Karthik M',
    dob: '14 May 2002',
    gender: 'Male',
    currentInstitution: 'PSG College of Technology, Coimbatore',
    stage: 'Graduated',
    district: 'Coimbatore',
    status: 'Graduated',
    aadhaarMismatch: false,
    consentPending: false,
    hasDigilockerAccount: true,
    digilockerDocumentsCount: 3,
    abcCreditsBalance: 158,
    contactEmail: 'karthik.sample@student.example.edu.in',
    contactPhone: '+91 90000 00052',
    credentials: [],
  },
];

describe('APAAR QR Scanner Parser and Resolver', () => {
  it('correctly parses official MoE web verification URL', () => {
    const rawUrl = 'https://apaar.education.gov.in/verify?id=299095832586&name=Abinaya%20S&pen=20194817290';
    const result = parseApaarQrPayload(rawUrl);

    assert.equal(result.success, true);
    assert.equal(result.data?.apaarId, '2990 9583 2586');
    assert.equal(result.data?.name, 'Abinaya S');
    assert.equal(result.data?.pen, '20194817290');
    assert.equal(result.data?.format, 'URL');
  });

  it('correctly parses custom scheme apaar:// verification URL', () => {
    const rawCustomScheme = 'apaar://verify?id=868625781740';
    const result = parseApaarQrPayload(rawCustomScheme);

    assert.equal(result.success, true);
    assert.equal(result.data?.apaarId, '8686 2578 1740');
    assert.equal(result.data?.format, 'URL');
  });

  it('correctly parses embedded JSON format from physical card chip/QR', () => {
    const jsonPayload = JSON.stringify({
      apaarId: '2990 9583 2586',
      name: 'Abinaya S',
      dob: '19 Nov 2003',
      pen: '20194817290',
      institution: 'Institute of Technology, Attur',
    });

    const result = parseApaarQrPayload(jsonPayload);
    assert.equal(result.success, true);
    assert.equal(result.data?.apaarId, '2990 9583 2586');
    assert.equal(result.data?.name, 'Abinaya S');
    assert.equal(result.data?.institution, 'Institute of Technology, Attur');
    assert.equal(result.data?.format, 'JSON');
  });

  it('correctly parses raw 12-digit plain text with and without spaces', () => {
    const unspaced = '299095832586';
    const res1 = parseApaarQrPayload(unspaced);
    assert.equal(res1.success, true);
    assert.equal(res1.data?.apaarId, '2990 9583 2586');

    const spaced = '2990 9583 2586';
    const res2 = parseApaarQrPayload(spaced);
    assert.equal(res2.success, true);
    assert.equal(res2.data?.apaarId, '2990 9583 2586');
  });

  it('correctly parses colon-delimited UDISE / DigiLocker string', () => {
    const colonStr = 'UDISE:868625781740:Karthik M';
    const result = parseApaarQrPayload(colonStr);
    assert.equal(result.success, true);
    assert.equal(result.data?.apaarId, '8686 2578 1740');
    assert.equal(result.data?.format, 'UDISE_COLON');
  });

  it('rejects invalid or corrupted QR payload', () => {
    const invalidPayload = 'INVALID_BARCODE_NOT_APAAR_99999';
    const result = parseApaarQrPayload(invalidPayload);
    assert.equal(result.success, false);
    assert.match(result.error || '', /Invalid APAAR QR code format/);
  });

  it('resolves student record correctly from scanned payload', () => {
    const rawUrl = 'https://apaar.education.gov.in/verify?id=299095832586';
    const resolveResult = resolveStudentFromQr(rawUrl, MOCK_STUDENTS);

    assert.equal(resolveResult.success, true);
    assert.equal(resolveResult.student?.name, 'Abinaya S');
    assert.equal(resolveResult.student?.district, 'Salem');
  });

  it('returns appropriate error when student is not found in registry', () => {
    const unknownIdPayload = '9999 8888 7777';
    const resolveResult = resolveStudentFromQr(unknownIdPayload, MOCK_STUDENTS);

    assert.equal(resolveResult.success, false);
    assert.match(resolveResult.error || '', /not found in active student registry/);
  });

  it('generates reproducible QR URL payload for physical cards', () => {
    const payload = generateApaarQrPayload(MOCK_STUDENTS[0]);
    assert.match(payload, /^https:\/\/apaar\.education\.gov\.in\/verify\?id=299095832586/);
    assert.match(payload, /Abinaya/);
  });
});
