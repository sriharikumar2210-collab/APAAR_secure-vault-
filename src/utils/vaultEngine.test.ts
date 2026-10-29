/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVaultUri,
  isVaultUri,
  parseVaultUri,
  ensureVaultUri,
  buildVaultReceipt,
  computeVaultFileMetadata,
  formatVaultFileSize,
  buildSampleVaultPdfText,
  decodeVaultDataUrlText,
  verifyDocumentViaOcr,
  buildHrVerificationDecisionReport,
  evaluateHrMultiStepReview,
} from './vaultEngine.ts';
import {
  seedDemoDataIfEmpty,
  insertCredentials,
  getStudentStored,
  getVaultDatabaseDiagnostics,
} from '../db/databaseService.ts';
import { generateHash, buildCredentialCanonicalPayload } from './verificationEngine.ts';
import type { AcademicCredential } from '../types/index.ts';


describe('APAAR Secure Credential Vault Engine', () => {
  it('constructs and parses canonical vault://apaar-registry/ URIs', () => {
    const uri = buildVaultUri('2990 9583 2586', 'CRED-ATTUR-DEG-01', 'DEGREE');
    assert.equal(uri, 'vault://apaar-registry/299095832586/degree/CRED-ATTUR-DEG-01');
    assert.equal(isVaultUri(uri), true);

    const parsed = parseVaultUri(uri);
    assert.ok(parsed);
    assert.equal(parsed.apaarDigits, '299095832586');
    assert.equal(parsed.formattedApaarId, '2990 9583 2586');
    assert.equal(parsed.typeSlug, 'degree');
    assert.equal(parsed.credentialId, 'CRED-ATTUR-DEG-01');
  });

  it('rejects non-vault or malformed URIs when parsing', () => {
    assert.equal(isVaultUri('in.gov.digilocker.annauniv.deg.2023.299095832586'), false);
    assert.equal(parseVaultUri('in.gov.digilocker.annauniv.deg.2023.299095832586'), null);
    assert.equal(parseVaultUri('vault://apaar-registry/short/degree/CRED-1'), null);
  });

  it('converts legacy digilocker URIs into canonical vault URIs via ensureVaultUri', () => {
    const converted = ensureVaultUri(
      'in.gov.digilocker.annauniv.deg.2023.299095832586',
      '2990 9583 2586',
      'CRED-ATTUR-DEG-01',
      'DEGREE'
    );
    assert.equal(converted, 'vault://apaar-registry/299095832586/degree/CRED-ATTUR-DEG-01');

    const preserved = ensureVaultUri(converted, '2990 9583 2586', 'OTHER-ID', 'MARKSHEET');
    assert.equal(preserved, converted);
  });

  it('builds a deterministic cryptographic vault receipt', () => {
    const cred: AcademicCredential = {
      id: 'CRED-VAULT-101',
      type: 'DEGREE',
      title: 'B.Tech Information Technology',
      issuingInstitution: 'Institute of Technology, Attur',
      issuingAuthority: 'Anna University & AICTE',
      yearOfPassing: 2024,
      cgpaOrPercentage: '9.10 CGPA',
      specialization: 'Information Technology',
      digilockerUri: '',
      aicteApprovalNumber: 'AICTE-TN-2024-901',
      sha256Hash: 'abc123',
      digitalSignature: 'SIG-PKI-HMAC-998877',
      issuerCertificateSerial: 'APAAR-SERVER-HMAC-SHA256',
      timestamp: '2026-10-27T12:00:00Z',
    };
    const receipt = buildVaultReceipt(cred, 'Abinaya S', '2990 9583 2586');
    assert.equal(receipt.vaultVersion, 'APAAR-VAULT-1.0');
    assert.equal(receipt.vaultUri, 'vault://apaar-registry/299095832586/degree/CRED-VAULT-101');
    assert.equal(receipt.studentName, 'Abinaya S');
    assert.equal(receipt.studentApaarId, '2990 9583 2586');
    assert.match(receipt.canonicalPayloadDigest, /^[a-f0-9]{64}$/);
  });

  it('computes SHA-256 metadata for uploaded Vault documents and rejects invalid payloads', () => {
    const res = computeVaultFileMetadata({
      fileName: 'Abinaya_BTech_Degree_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24576,
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoK',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.meta.documentFileName, 'Abinaya_BTech_Degree_2024.pdf');
      assert.equal(res.meta.documentMimeType, 'application/pdf');
      assert.equal(res.meta.documentSizeBytes, 24576);
      assert.match(res.meta.documentFileSha256, /^[a-f0-9]{64}$/);
    }
    assert.equal(formatVaultFileSize(24576), '24.0 KB');

    const bad = computeVaultFileMetadata({
      fileName: 'bad.pdf',
      dataUrl: 'http://not-a-data-url',
    });
    assert.equal(bad.ok, false);
  });

  it('persists uploaded Vault credentials in the connected database and updates diagnostics', async () => {
    await seedDemoDataIfEmpty();
    const beforeDiag = await getVaultDatabaseDiagnostics();
    assert.equal(beforeDiag.connected, true);
    assert.ok(beforeDiag.databaseName.includes('ai-studio-apaarstudentregi'));
    assert.ok(beforeDiag.totalStudents > 0);
    assert.ok(beforeDiag.totalSealedCredentials > 0);

    const uploadedCred: AcademicCredential = {
      id: 'CRED-VAULT-DB-TEST-01',
      type: 'MARKSHEET',
      title: 'Vault DB Persistence Test Marksheet',
      issuingInstitution: 'Institute of Technology, Attur',
      issuingAuthority: 'APAAR Secure Credential Vault Root CA',
      yearOfPassing: 2026,
      cgpaOrPercentage: '9.40 CGPA',
      specialization: 'Information Technology',
      digilockerUri: 'vault://apaar-registry/299095832586/marksheet/CRED-VAULT-DB-TEST-01',
      aicteApprovalNumber: 'AICTE-VAULT-DB-01',
      sha256Hash: 'a'.repeat(64),
      digitalSignature: 'b'.repeat(64),
      issuerCertificateSerial: 'APAAR-SERVER-HMAC-SHA256',
      timestamp: new Date().toISOString(),
      documentFileName: 'Abinaya_Marksheet_2026.pdf',
      documentMimeType: 'application/pdf',
      documentSizeBytes: 1024,
      documentFileSha256: 'c'.repeat(64),
      documentDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    };

    await insertCredentials('2990 9583 2586', [uploadedCred]);
    const studentAfter = await getStudentStored('2990 9583 2586');
    assert.ok(studentAfter);
    const saved = studentAfter.credentials.find(c => c.id === 'CRED-VAULT-DB-TEST-01');
    assert.ok(saved);
    assert.equal(saved.documentFileName, 'Abinaya_Marksheet_2026.pdf');

    const afterDiag = await getVaultDatabaseDiagnostics();
    assert.equal(afterDiag.totalSealedCredentials, beforeDiag.totalSealedCredentials + 1);
    assert.equal(afterDiag.totalUploadedDocuments, beforeDiag.totalUploadedDocuments + 1);
  });

  it('extracts OCR fields from uploaded PDF documents and verifies all 7 fields against APAAR Vault DB', () => {
    const samplePdf = buildSampleVaultPdfText({
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      title: 'Bachelor of Technology (B.Tech) - Information Technology',
      issuingInstitution: 'Institute of Technology, Attur',
      yearOfPassing: 2023,
      cgpaOrPercentage: '8.82 CGPA',
      credentialId: 'CRED-OCR-01',
    });
    const dataUrl = `data:application/pdf;base64,${Buffer.from(samplePdf, 'utf8').toString('base64')}`;
    const decoded = decodeVaultDataUrlText(dataUrl);
    assert.ok(decoded.includes('Candidate: Abinaya S'));

    const baseCred: AcademicCredential = {
      id: 'CRED-OCR-01',
      type: 'DEGREE',
      title: 'Bachelor of Technology (B.Tech) - Information Technology',
      issuingInstitution: 'Institute of Technology, Attur',
      issuingAuthority: 'APAAR Secure Credential Vault Root CA',
      specialization: 'Information Technology',
      yearOfPassing: 2023,
      cgpaOrPercentage: '8.82 CGPA',
      digilockerUri: 'vault://apaar-registry/299095832586/degree/CRED-OCR-01',
      aicteApprovalNumber: 'AICTE-TN-2023-01',
      sha256Hash: '',
      digitalSignature: 'SIG-OCR-01',
      issuerCertificateSerial: 'NAD-AICTE-PKI-2023-74198E',
      timestamp: new Date().toISOString(),
      documentFileName: 'Abinaya_BTech_2023.pdf',
      documentMimeType: 'application/pdf',
      documentDataUrl: dataUrl,
    };
    baseCred.sha256Hash = generateHash(buildCredentialCanonicalPayload(baseCred));

    const ocrOk = verifyDocumentViaOcr({
      credential: baseCred,
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
    });
    assert.equal(ocrOk.verified, true);
    assert.equal(ocrOk.matchedFieldsCount, 7);
    assert.equal(ocrOk.totalFieldsCount, 7);
    assert.equal(ocrOk.extractedFields.candidateName, 'Abinaya S');
    assert.equal(ocrOk.extractedFields.apaarId, '2990 9583 2586');

    const ocrTampered = verifyDocumentViaOcr({
      credential: baseCred,
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      simulateTamper: true,
    });
    assert.equal(ocrTampered.verified, false);
    assert.ok(ocrTampered.matchedFieldsCount < ocrTampered.totalFieldsCount);

    const hrApproved = buildHrVerificationDecisionReport({
      credential: baseCred,
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      hrVerifierName: 'Kavitha Ramachandran',
      hrOrganization: 'Tata Consultancy Services',
      hrDecision: 'APPROVE',
      hrRemarks: 'Verified all 7 OCR fields and Vault HMAC seal for onboarding.',
    });
    assert.equal(hrApproved.verified, true);
    assert.equal(hrApproved.finalRequestStatus, 'VERIFIED');
    assert.equal(hrApproved.ocrReport.matchedFieldsCount, 7);
    assert.ok(hrApproved.hrVerificationId.startsWith('HR-VER-'));

    const hrRejected = buildHrVerificationDecisionReport({
      credential: baseCred,
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      hrVerifierName: 'Kavitha Ramachandran',
      hrOrganization: 'Tata Consultancy Services',
      hrDecision: 'REJECT',
      hrRemarks: 'CGPA discrepancy flagged during HR audit.',
    });
    assert.equal(hrRejected.verified, false);
    assert.equal(hrRejected.finalRequestStatus, 'TAMPERED_FAILED');

    const flaggedBatch = evaluateHrMultiStepReview({
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      hrVerifierName: 'Kavitha Ramachandran',
      hrOrganization: 'Tata Consultancy Services',
      items: [
        {
          slotId: 'slot-degree',
          slotName: 'Slot 1: B.Tech Degree',
          documentNumber: 'AU-DEG-2023-882109',
          reviewStatus: 'VERIFIED',
          comment: 'Degree OCR & SHA-256 verified.',
          reviewedBy: 'Kavitha Ramachandran',
          reviewedAt: '2026-10-28T10:00:00Z',
        },
        {
          slotId: 'slot-marksheet',
          slotName: 'Slot 2: Consolidated Marksheet',
          documentNumber: 'AU-CSG-2023-99412',
          reviewStatus: 'FLAGGED_FOR_CORRECTION',
          comment: 'Semester 6 grade scan unclear — flagged for correction.',
          reviewedBy: 'Kavitha Ramachandran',
          reviewedAt: '2026-10-28T10:01:00Z',
        },
      ],
      submitAction: 'FLAG_CORRECTIONS',
    });
    assert.equal(flaggedBatch.canApproveFinal, false);
    assert.equal(flaggedBatch.flaggedForCorrectionCount, 1);
    assert.equal(flaggedBatch.verifiedCount, 1);
    assert.equal(flaggedBatch.overallDecision, 'RETURNED_FOR_CORRECTION');

    const approvedBatch = evaluateHrMultiStepReview({
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      hrVerifierName: 'Kavitha Ramachandran',
      hrOrganization: 'Tata Consultancy Services',
      items: flaggedBatch.items.map(i => ({ ...i, reviewStatus: 'VERIFIED', comment: 'All verified via OCR.' })),
      submitAction: 'APPROVE_FINAL',
    });
    assert.equal(approvedBatch.canApproveFinal, true);
    assert.equal(approvedBatch.overallDecision, 'FINAL_APPROVED');
    assert.equal(approvedBatch.verifiedCount, 2);
  });
});



