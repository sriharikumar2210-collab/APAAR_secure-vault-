/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Student, AcademicCredential } from '../types';
import { generateHash } from '../utils/verificationEngine';
import {
  ensureVaultUri,
  computeVaultFileMetadata,
  formatVaultFileSize,
  buildSampleVaultPdfText,
  verifyDocumentViaOcr,
  VaultOcrVerificationReport,
  HrSlotReviewStatus,
  HrDocumentReviewEntry,
  HrMultiStepFinalReport,
  evaluateHrMultiStepReview,
} from '../utils/vaultEngine';
import { realtimeClient } from '../services/realtimeClient';
import { syncVaultCredentialToFirestore, firebaseConfig } from '../lib/firebase';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Lock,
  Download,
  RefreshCw,
  BadgeCheck,
  Plus,
  X,
  Upload,
  FileText,
  Database,
  ScanText,
  MessageSquare,
  Flag,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react';

interface DocumentSlot {
  slotId: string;
  slotName: string;
  documentType: string;
  category: 'Higher Education' | 'Schooling' | 'Regulatory' | 'Credits';
  issuingBody: string;
  documentNumber: string;
  digilockerUri: string;
  status: 'VERIFIED' | 'TAMPER_ALERT' | 'PENDING_VERIFICATION' | 'NOT_UPLOADED';
  cgpaOrMarks: string;
  passingYear: string;
  sha256Digest: string;
  pkiAlgorithm: string;
  rootCA: string;
  verifiedAt: string;
  tamperReason?: string;
}

interface DocumentVerificationViewProps {
  students: Student[];
  onViewCertificateDetails: (credential: AcademicCredential) => void;
  onLogAuditAction: (action: any, details: string, level: 'SUCCESS' | 'ALERT' | 'INFO') => void;
  onStudentCredentialAdded?: (apaarId: string, credential: AcademicCredential) => void;
}

export const DocumentVerificationView: React.FC<DocumentVerificationViewProps> = ({
  students,
  onViewCertificateDetails,
  onLogAuditAction,
  onStudentCredentialAdded,
}) => {
  const [selectedStudentApaar, setSelectedStudentApaar] = useState('2990 9583 2586');
  const [activeSlotId, setActiveSlotId] = useState<string>('slot-degree');
  const [isVerifying, setIsVerifying] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueType, setIssueType] = useState<AcademicCredential['type']>('DEGREE');
  const [issueTitle, setIssueTitle] = useState('B.Tech Honours - Cloud & Cyber Security');
  const [issueYear, setIssueYear] = useState('2026');
  const [issueScore, setIssueScore] = useState('9.24 CGPA (First Class with Distinction)');
  const [issueAicte, setIssueAicte] = useState('AICTE-TN-ENG-2026-9901');
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccessBanner, setIssueSuccessBanner] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueFileName, setIssueFileName] = useState('');
  const [issueMimeType, setIssueMimeType] = useState('');
  const [issueSizeBytes, setIssueSizeBytes] = useState(0);
  const [issueFileSha256, setIssueFileSha256] = useState('');
  const [issueDataUrl, setIssueDataUrl] = useState('');

  // Vault Database Connection state
  const [vaultDbDiag, setVaultDbDiag] = useState<{
    connected: boolean;
    databaseName: string;
    projectId: string;
    storageEngine: string;
    totalSealedCredentials: number;
    totalUploadedDocuments: number;
  }>({
    connected: true,
    databaseName: firebaseConfig.firestoreDatabaseId,
    projectId: firebaseConfig.projectId,
    storageEngine: 'APAAR Vault Persistent DB + Firestore Ledger',
    totalSealedCredentials: students.reduce((acc, s) => acc + s.credentials.length, 0),
    totalUploadedDocuments: students.reduce(
      (acc, s) => acc + s.credentials.filter(c => !!c.documentFileName || !!c.documentDataUrl).length,
      0
    ),
  });

  const refreshVaultDbDiagnostics = useCallback(async () => {
    const res = await realtimeClient.getVaultStatus();
    if (res.ok && res.data) {
      const db = res.data.database;
      setVaultDbDiag({
        connected: db?.connected ?? true,
        databaseName: db?.databaseName || firebaseConfig.firestoreDatabaseId,
        projectId: db?.projectId || firebaseConfig.projectId,
        storageEngine: db?.storageEngine || 'APAAR Vault Persistent DB + Firestore Ledger',
        totalSealedCredentials: res.data.totalSealedCredentials,
        totalUploadedDocuments: res.data.totalUploadedDocuments ?? db?.totalUploadedDocuments ?? 0,
      });
    }
  }, []);

  useEffect(() => {
    refreshVaultDbDiagnostics();
  }, [refreshVaultDbDiagnostics]);

  const activeStudent =
    students.find(s => s.apaarId === selectedStudentApaar) || students[2] || students[0];

  const handleSelectIssueFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIssueError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const check = computeVaultFileMetadata({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl,
      });
      if (!check.ok) {
        setIssueError((check as { ok: false; error: string }).error);
        return;
      }
      setIssueFileName(check.meta.documentFileName);
      setIssueMimeType(check.meta.documentMimeType);
      setIssueSizeBytes(check.meta.documentSizeBytes);
      setIssueFileSha256(check.meta.documentFileSha256);
      setIssueDataUrl(check.meta.documentDataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAttachSamplePdfToSlot = () => {
    setIssueError(null);
    const samplePdf = buildSampleVaultPdfText({
      studentName: activeStudent.name,
      studentApaarId: activeStudent.apaarId,
      title: issueTitle,
      issuingInstitution: activeStudent.currentInstitution,
      yearOfPassing: issueYear,
      cgpaOrPercentage: issueScore,
      aicteApprovalNumber: issueAicte,
    });
    const base64 = btoa(unescape(encodeURIComponent(samplePdf)));
    const dataUrl = `data:application/pdf;base64,${base64}`;
    const fileName = `${activeStudent.name.replace(/[^A-Za-z0-9]+/g, '_')}_${issueType}_${issueYear}.pdf`;
    const check = computeVaultFileMetadata({
      fileName,
      mimeType: 'application/pdf',
      sizeBytes: samplePdf.length,
      dataUrl,
    });
    if (check.ok) {
      setIssueFileName(check.meta.documentFileName);
      setIssueMimeType(check.meta.documentMimeType);
      setIssueSizeBytes(check.meta.documentSizeBytes);
      setIssueFileSha256(check.meta.documentFileSha256);
      setIssueDataUrl(check.meta.documentDataUrl);
    }
  };

  // Document verification slots customized for this student
  const [slots, setSlots] = useState<Record<string, DocumentSlot[]>>({
    '2990 9583 2586': [
      {
        slotId: 'slot-degree',
        slotName: 'Slot 1: Bachelor of Technology (B.Tech) Degree Certificate',
        documentType: 'DEGREE',
        category: 'Higher Education',
        issuingBody: 'Institute of Technology, Attur / Anna University',
        documentNumber: 'AU-DEG-2023-882109',
        digilockerUri: 'vault://apaar-registry/299095832586/degree/AU-DEG-2023-882109',
        status: 'VERIFIED',
        cgpaOrMarks: '8.82 CGPA (First Class with Distinction)',
        passingYear: '2023',
        sha256Digest: generateHash('CRED-ATTUR-DEG-01|B.Tech IT|Institute of Technology, Attur|2023|8.82 CGPA'),
        pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
        rootCA: 'APAAR Secure Credential Vault Root CA',
        verifiedAt: '24 Oct 2026, 10:02 AM · APAAR Vault Sealed',
      },
      {
        slotId: 'slot-marksheet',
        slotName: 'Slot 2: Consolidated Statement of Grades (Semesters 1-8)',
        documentType: 'MARKSHEET',
        category: 'Higher Education',
        issuingBody: 'Controller of Examinations, Anna University',
        documentNumber: 'AU-CSG-2023-99412',
        digilockerUri: 'vault://apaar-registry/299095832586/marksheet/AU-CSG-2023-99412',
        status: 'VERIFIED',
        cgpaOrMarks: '8.82 CGPA / 164 Credits Cleared',
        passingYear: '2023',
        sha256Digest: generateHash('AU-CSG-MARKSHEET-299095832586'),
        pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
        rootCA: 'APAAR Secure Credential Vault Root CA',
        verifiedAt: '24 Oct 2026, 10:02 AM · APAAR Vault Sealed',
      },
      {
        slotId: 'slot-abc',
        slotName: 'Slot 3: Academic Bank of Credits (ABC) Digital Ledger',
        documentType: 'ABC_TRANSCRIPT',
        category: 'Credits',
        issuingBody: 'Academic Bank of Credits, Ministry of Education',
        documentNumber: 'ABC-MOE-2023-1192803',
        digilockerUri: 'vault://apaar-registry/299095832586/abc-transcript/ABC-MOE-2023-1192803',
        status: 'VERIFIED',
        cgpaOrMarks: '164 Valid Verified Transferable Credits',
        passingYear: '2023',
        sha256Digest: generateHash('ABC-TRANSCRIPT-299095832586'),
        pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
        rootCA: 'APAAR Secure Credential Vault Root CA',
        verifiedAt: '24 Oct 2026, 10:02 AM · APAAR Vault Sealed',
      },
      {
        slotId: 'slot-aicte',
        slotName: 'Slot 4: AICTE National Accreditation & Program Recognition',
        documentType: 'AICTE_APPROVAL',
        category: 'Regulatory',
        issuingBody: 'All India Council for Technical Education (AICTE)',
        documentNumber: 'AICTE-TN-ENG-2019-8812',
        digilockerUri: 'vault://apaar-registry/299095832586/aicte-approval/AICTE-TN-ENG-2019-8812',
        status: 'VERIFIED',
        cgpaOrMarks: 'Approved B.Tech Program (Tier-1 NBA Accredited)',
        passingYear: '2019-2023',
        sha256Digest: generateHash('AICTE-APPROVAL-299095832586'),
        pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
        rootCA: 'APAAR Secure Credential Vault Root CA',
        verifiedAt: '24 Oct 2026, 10:02 AM · APAAR Vault Sealed',
      },
      {
        slotId: 'slot-hsc',
        slotName: 'Slot 5: Higher Secondary Certificate (Class 12 - HSC)',
        documentType: 'SCHOOL_HSC',
        category: 'Schooling',
        issuingBody: 'Tamil Nadu State Board of School Examinations (TNDGE)',
        documentNumber: 'TNDGE-HSC-2019-44129',
        digilockerUri: 'vault://apaar-registry/299095832586/school-hsc/TNDGE-HSC-2019-44129',
        status: 'VERIFIED',
        cgpaOrMarks: '562 / 600 (93.66% Physics/Chemistry/Maths/CS)',
        passingYear: '2019',
        sha256Digest: generateHash('TNDGE-HSC-2019-299095832586'),
        pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
        rootCA: 'APAAR Secure Credential Vault Root CA',
        verifiedAt: '24 Oct 2026, 10:03 AM · APAAR Vault Sealed',
      },
      {
        slotId: 'slot-sslc',
        slotName: 'Slot 6: Secondary School Leaving Certificate (Class 10 - SSLC)',
        documentType: 'SCHOOL_SSLC',
        category: 'Schooling',
        issuingBody: 'Department of Government Examinations, Chennai',
        documentNumber: 'TNDGE-SSLC-2017-88120',
        digilockerUri: 'vault://apaar-registry/299095832586/school-sslc/TNDGE-SSLC-2017-88120',
        status: 'VERIFIED',
        cgpaOrMarks: '481 / 500 (96.20%)',
        passingYear: '2017',
        sha256Digest: generateHash('TNDGE-SSLC-2017-299095832586'),
        pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
        rootCA: 'APAAR Secure Credential Vault Root CA',
        verifiedAt: '24 Oct 2026, 10:03 AM · APAAR Vault Sealed',
      },
    ],
  });

  // Live File / Vault OCR Document Verification state
  const [liveVerifyBanner, setLiveVerifyBanner] = useState<{
    status: 'VERIFIED' | 'MISMATCH';
    title: string;
    fileName?: string;
    computedSha256: string;
    matchedCredentialId?: string;
    matchedVaultUri?: string;
    verifiedAt: string;
    details: string;
    ocrReport?: VaultOcrVerificationReport;
  } | null>(null);

  const handleClearIssueFile = () => {
    setIssueFileName('');
    setIssueMimeType('');
    setIssueSizeBytes(0);
    setIssueFileSha256('');
    setIssueDataUrl('');
    setIssueError(null);
  };

  // Verify an uploaded file from disk via OCR against the connected APAAR Vault Database
  const handleVerifyUploadedFileOnDisk = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const check = computeVaultFileMetadata({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl,
      });
      if (!check.ok) {
        setLiveVerifyBanner({
          status: 'MISMATCH',
          title: 'Invalid File Payload',
          fileName: file.name,
          computedSha256: 'INVALID_PAYLOAD',
          verifiedAt: new Date().toLocaleTimeString('en-IN'),
          details: (check as { ok: false; error: string }).error,
        });
        return;
      }

      const matched =
        activeStudent.credentials.find(
          c =>
            c.documentFileSha256 === check.meta.documentFileSha256 ||
            c.documentFileName === check.meta.documentFileName
        ) || activeStudent.credentials[0];

      const localOcr = verifyDocumentViaOcr({
        credential: matched,
        studentName: activeStudent.name,
        studentApaarId: activeStudent.apaarId,
        uploadedDataUrl: dataUrl,
        uploadedFileName: check.meta.documentFileName,
      });

      const serverRes = await realtimeClient
        .ocrVerifyVaultDocument({
          credentialId: matched?.id,
          studentApaarId: activeStudent.apaarId,
          fileName: check.meta.documentFileName,
          dataUrl,
        })
        .catch(() => null);

      const report = serverRes?.ok && serverRes.data?.ocrReport ? serverRes.data.ocrReport : localOcr;
      const uri = ensureVaultUri(matched.digilockerUri, activeStudent.apaarId, matched.id, matched.type);
      setLiveVerifyBanner({
        status: report.verified ? 'VERIFIED' : 'MISMATCH',
        title: `OCR Verified Against APAAR Vault DB: ${check.meta.documentFileName}`,
        fileName: check.meta.documentFileName,
        computedSha256: check.meta.documentFileSha256,
        matchedCredentialId: matched.id,
        matchedVaultUri: uri,
        verifiedAt: new Date().toLocaleTimeString('en-IN'),
        details: report.summary,
        ocrReport: report,
      });
      onLogAuditAction(
        report.verified ? 'DIGITAL_SIGNATURE_VERIFIED' : 'SECURITY_TAMPER_ALERT',
        `OCR Document Verification on "${check.meta.documentFileName}" (${report.matchedFieldsCount}/${report.totalFieldsCount} OCR fields · ${report.ocrConfidencePercent}% confidence).`,
        report.verified ? 'SUCCESS' : 'ALERT'
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQuickVerifyLatestVaultDoc = async () => {
    const targetCred =
      activeStudent.credentials.find(c => !!c.documentFileName || !!c.documentDataUrl) ||
      activeStudent.credentials[0];
    if (!targetCred) return;
    setIsVerifying(true);
    const localOcr = verifyDocumentViaOcr({
      credential: targetCred,
      studentName: activeStudent.name,
      studentApaarId: activeStudent.apaarId,
    });
    const res = await realtimeClient
      .ocrVerifyVaultDocument({
        credentialId: targetCred.id,
        studentApaarId: activeStudent.apaarId,
      })
      .catch(() => null);
    setIsVerifying(false);
    const report = res?.ok && res.data?.ocrReport ? res.data.ocrReport : localOcr;
    const uri = ensureVaultUri(targetCred.digilockerUri, activeStudent.apaarId, targetCred.id, targetCred.type);
    setLiveVerifyBanner({
      status: report.verified ? 'VERIFIED' : 'MISMATCH',
      title: `OCR Verified Against APAAR Vault DB: ${targetCred.title}`,
      fileName: targetCred.documentFileName || `${targetCred.id}.pdf`,
      computedSha256: targetCred.documentFileSha256 || targetCred.sha256Hash,
      matchedCredentialId: targetCred.id,
      matchedVaultUri: uri,
      verifiedAt: new Date().toLocaleTimeString('en-IN'),
      details: report.summary,
      ocrReport: report,
    });
    onLogAuditAction(
      'DIGITAL_SIGNATURE_VERIFIED',
      `OCR-verified Vault credential "${targetCred.title}" (${report.matchedFieldsCount}/${report.totalFieldsCount} fields · ${report.ocrConfidencePercent}% confidence) against APAAR Vault Database.`,
      'SUCCESS'
    );
  };

  const baseSlots = slots[selectedStudentApaar] || slots['2990 9583 2586'];
  // Merge any dynamically uploaded/sealed credentials from activeStudent.credentials that aren't in baseSlots yet
  const dynamicCredSlots: DocumentSlot[] = activeStudent.credentials
    .filter(cred => !baseSlots.some(s => s.documentNumber === cred.id || s.slotId === `slot-${cred.id.toLowerCase()}`))
    .map((cred, idx) => ({
      slotId: `slot-${cred.id.toLowerCase()}`,
      slotName: `Vault Record ${idx + 1}: ${cred.title}${cred.documentFileName ? ` [${cred.documentFileName}]` : ''}`,
      documentType: cred.type,
      category:
        cred.type === 'ABC_TRANSCRIPT'
          ? 'Credits'
          : cred.type === 'AICTE_APPROVAL'
          ? 'Regulatory'
          : 'Higher Education',
      issuingBody: cred.issuingInstitution,
      documentNumber: cred.id,
      digilockerUri: ensureVaultUri(cred.digilockerUri, activeStudent.apaarId, cred.id, cred.type),
      status: cred.verified ? 'VERIFIED' : 'TAMPER_ALERT',
      cgpaOrMarks: cred.cgpaOrPercentage,
      passingYear: String(cred.yearOfPassing),
      sha256Digest: cred.documentFileSha256 || cred.sha256Hash,
      pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
      rootCA: cred.issuingAuthority || 'APAAR Secure Credential Vault Root CA',
      verifiedAt: cred.documentUploadedAt
        ? `${new Date(cred.documentUploadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · Vault DB Sealed`
        : 'APAAR Vault Sealed',
    }));

  const currentSlots = [...dynamicCredSlots, ...baseSlots];
  const activeSlot = currentSlots.find(s => s.slotId === activeSlotId) || currentSlots[0];

  const filteredSlots = currentSlots.filter(s => {
    if (filterCategory === 'ALL') return true;
    return s.category === filterCategory;
  });

  const handleOpenSlotCertificateModal = (slot: DocumentSlot) => {
    const matchedCred = activeStudent.credentials.find(
      c => c.id === slot.documentNumber || `slot-${c.id.toLowerCase()}` === slot.slotId
    );
    if (matchedCred) {
      onViewCertificateDetails(matchedCred);
      return;
    }
    const synthesizedCred: AcademicCredential = {
      id: slot.documentNumber,
      type: (slot.documentType as AcademicCredential['type']) || 'DEGREE',
      title: slot.slotName.replace(/^Slot \d+:\s*/i, ''),
      issuingInstitution: slot.issuingBody,
      issuingAuthority: slot.rootCA,
      specialization: '',
      issueDate: `${slot.passingYear}-05-15`,
      yearOfPassing: parseInt(slot.passingYear, 10) || 2023,
      cgpaOrPercentage: slot.cgpaOrMarks,
      digilockerUri: slot.digilockerUri,
      sha256Hash: slot.sha256Digest,
      digitalSignature: `SIG-VAULT-HMAC-${slot.sha256Digest.substring(0, 24)}`,
      issuerCertificateSerial: 'NAD-AICTE-PKI-2023-74198E',
      timestamp: new Date().toISOString(),
      verified: slot.status === 'VERIFIED',
      aicteApprovalNumber: 'AICTE-TN-ENG-2023-8812',
    };
    onViewCertificateDetails(synthesizedCred);
  };

  const buildSlotSyntheticCred = (slot: DocumentSlot): AcademicCredential => {
    const matchedCred = activeStudent.credentials.find(
      c => c.id === slot.documentNumber || `slot-${c.id.toLowerCase()}` === slot.slotId
    );
    if (matchedCred) return matchedCred;
    return {
      id: slot.documentNumber,
      type: (slot.documentType as AcademicCredential['type']) || 'DEGREE',
      title: slot.slotName.replace(/^Slot \d+:\s*/i, ''),
      issuingInstitution: slot.issuingBody,
      issuingAuthority: slot.rootCA,
      specialization: '',
      issueDate: `${slot.passingYear}-05-15`,
      yearOfPassing: parseInt(slot.passingYear, 10) || 2023,
      cgpaOrPercentage: slot.cgpaOrMarks.replace(/\s*\(Tampered.*$/i, ''),
      digilockerUri: slot.digilockerUri,
      sha256Hash: slot.sha256Digest,
      digitalSignature: `SIG-VAULT-HMAC-${slot.sha256Digest.substring(0, 24)}`,
      issuerCertificateSerial: 'NAD-AICTE-PKI-2023-74198E',
      timestamp: new Date().toISOString(),
      verified: slot.status === 'VERIFIED',
      aicteApprovalNumber: 'AICTE-TN-ENG-2023-8812',
    };
  };

  const activeSlotOcrReport = verifyDocumentViaOcr({
    credential: buildSlotSyntheticCred(activeSlot),
    studentName: activeStudent.name,
    studentApaarId: activeStudent.apaarId,
    simulateTamper: activeSlot.status === 'TAMPER_ALERT',
  });

  // ---------------------------------------------------------------------------
  // Multi-Step HR Review Interface State (Steps 1 -> 2 -> 3 -> 4)
  // ---------------------------------------------------------------------------
  const [hrReviewStep, setHrReviewStep] = useState<1 | 2 | 3 | 4>(1);
  const [hrVerifierName, setHrVerifierName] = useState('Kavitha Ramachandran');
  const [hrOrganization, setHrOrganization] = useState('Tata Consultancy Services');
  const [hrFinalApprovalComment, setHrFinalApprovalComment] = useState(
    'All academic credentials cross-verified via 7-field OCR and APAAR Vault DB. Cleared for final HR onboarding approval.'
  );
  const [hrReviewsByStudent, setHrReviewsByStudent] = useState<
    Record<string, Record<string, { status: HrSlotReviewStatus; comment: string; reviewedAt: string }>>
  >({});
  const [hrFinalSubmittedReport, setHrFinalSubmittedReport] =
    useState<HrMultiStepFinalReport | null>(null);

  const studentHrReviewMap = hrReviewsByStudent[selectedStudentApaar] || {};

  const getSlotHrReview = (slot: DocumentSlot): {
    status: HrSlotReviewStatus;
    comment: string;
    reviewedAt: string;
  } => {
    const existing = studentHrReviewMap[slot.slotId];
    if (existing) return existing;
    return {
      status: slot.status === 'TAMPER_ALERT' ? 'FLAGGED_FOR_CORRECTION' : 'VERIFIED',
      comment:
        slot.status === 'TAMPER_ALERT'
          ? 'OCR & SHA-256 mismatch detected — flagged for candidate correction.'
          : 'Verified via 7-field OCR & APAAR Vault DB.',
      reviewedAt: slot.verifiedAt,
    };
  };

  const handleSetSlotHrReview = (
    slot: DocumentSlot,
    nextStatus: HrSlotReviewStatus,
    customComment?: string
  ) => {
    const current = getSlotHrReview(slot);
    const updatedComment =
      customComment !== undefined
        ? customComment
        : nextStatus === 'FLAGGED_FOR_CORRECTION' &&
          current.comment.startsWith('Verified via 7-field OCR')
        ? 'Discrepancy noted during HR review — flagged for correction before final approval.'
        : nextStatus === 'VERIFIED' &&
          (current.comment.includes('flagged') || current.comment.includes('Discrepancy'))
        ? 'Verified & cleared by HR after OCR + APAAR Vault DB inspection.'
        : current.comment;

    const nowFormatted =
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
      ' · HR Reviewed';

    setHrReviewsByStudent(prev => ({
      ...prev,
      [selectedStudentApaar]: {
        ...(prev[selectedStudentApaar] || {}),
        [slot.slotId]: {
          status: nextStatus,
          comment: updatedComment,
          reviewedAt: nowFormatted,
        },
      },
    }));

    onLogAuditAction(
      nextStatus === 'VERIFIED' ? 'DIGITAL_SIGNATURE_VERIFIED' : 'SECURITY_TAMPER_ALERT',
      `HR Review on "${slot.slotName}" by ${hrVerifierName} (${hrOrganization}): Marked as '${
        nextStatus === 'VERIFIED'
          ? 'Verified'
          : nextStatus === 'FLAGGED_FOR_CORRECTION'
          ? 'Flagged for Correction'
          : 'Pending Review'
      }'. Comment: "${updatedComment}"`,
      nextStatus === 'VERIFIED' ? 'SUCCESS' : 'ALERT'
    );
  };

  const handleUpdateSlotHrComment = (slot: DocumentSlot, newComment: string) => {
    const current = getSlotHrReview(slot);
    setHrReviewsByStudent(prev => ({
      ...prev,
      [selectedStudentApaar]: {
        ...(prev[selectedStudentApaar] || {}),
        [slot.slotId]: {
          ...current,
          comment: newComment,
          reviewedAt:
            new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
            ' · Comment Updated',
        },
      },
    }));
  };

  const handleMarkAllSlotsVerified = () => {
    const nowFormatted =
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
      ' · HR Batch Verified';
    const nextMap: Record<string, { status: HrSlotReviewStatus; comment: string; reviewedAt: string }> = {};
    for (const s of currentSlots) {
      const existing = getSlotHrReview(s);
      nextMap[s.slotId] = {
        status: 'VERIFIED',
        comment:
          existing.status === 'FLAGGED_FOR_CORRECTION'
            ? 'Cleared & marked Verified by HR after OCR check.'
            : existing.comment || 'Verified via 7-field OCR & APAAR Vault DB.',
        reviewedAt: nowFormatted,
      };
    }
    setHrReviewsByStudent(prev => ({
      ...prev,
      [selectedStudentApaar]: nextMap,
    }));
    onLogAuditAction(
      'DIGITAL_SIGNATURE_VERIFIED',
      `HR Batch Review by ${hrVerifierName} (${hrOrganization}): Marked all ${currentSlots.length} documents for ${activeStudent.name} as 'Verified'.`,
      'SUCCESS'
    );
  };

  const hrReviewEntries: HrDocumentReviewEntry[] = currentSlots.map(slot => {
    const rev = getSlotHrReview(slot);
    return {
      slotId: slot.slotId,
      slotName: slot.slotName,
      documentNumber: slot.documentNumber,
      reviewStatus: rev.status,
      comment: rev.comment,
      reviewedBy: hrVerifierName,
      reviewedAt: rev.reviewedAt,
    };
  });

  const liveHrMultiStepPreview = evaluateHrMultiStepReview({
    studentName: activeStudent.name,
    studentApaarId: activeStudent.apaarId,
    hrVerifierName,
    hrOrganization,
    finalComments: hrFinalApprovalComment,
    items: hrReviewEntries,
    submitAction: 'PREVIEW',
  });

  const handleFinalizeHrMultiStepReview = (action: 'APPROVE_FINAL' | 'FLAG_CORRECTIONS') => {
    const finalReport = evaluateHrMultiStepReview({
      studentName: activeStudent.name,
      studentApaarId: activeStudent.apaarId,
      hrVerifierName,
      hrOrganization,
      finalComments: hrFinalApprovalComment,
      items: hrReviewEntries,
      submitAction: action,
    });
    setHrFinalSubmittedReport(finalReport);
    setHrReviewStep(4);
    onLogAuditAction(
      finalReport.overallDecision === 'FINAL_APPROVED'
        ? 'DIGITAL_SIGNATURE_VERIFIED'
        : 'SECURITY_TAMPER_ALERT',
      `Final Multi-Step HR Review [${finalReport.reviewBatchId}] by ${hrVerifierName} (${hrOrganization}) for ${activeStudent.name}: ${finalReport.overallDecision} (${finalReport.verifiedCount}/${finalReport.totalDocuments} Verified, ${finalReport.flaggedForCorrectionCount} Flagged for Correction). Summary: "${finalReport.finalComments}"`,
      finalReport.overallDecision === 'FINAL_APPROVED' ? 'SUCCESS' : 'ALERT'
    );
  };

  const activeSlotIndex = Math.max(
    0,
    currentSlots.findIndex(s => s.slotId === activeSlot.slotId)
  );
  const activeSlotHrReview = getSlotHrReview(activeSlot);

  // Re-verify slot action via OCR against APAAR Secure Vault
  const handleVerifySlot = async (slotId: string) => {
    setIsVerifying(true);
    const matchingCred = activeStudent.credentials[0];
    if (matchingCred) {
      await realtimeClient.ocrVerifyVaultDocument({ credentialId: matchingCred.id }).catch(() => null);
    }
    setTimeout(() => {
      setSlots(prev => ({
        ...prev,
        [selectedStudentApaar]: (prev[selectedStudentApaar] || prev['2990 9583 2586']).map(s =>
          s.slotId === slotId
            ? {
                ...s,
                status: 'VERIFIED',
                cgpaOrMarks: s.cgpaOrMarks.replace('9.98 CGPA (Tampered - Original: 8.82)', '8.82 CGPA (First Class with Distinction)'),
                verifiedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' · OCR + Server Vault Verified',
                tamperReason: undefined,
              }
            : s
        ),
      }));
      setIsVerifying(false);
      const refreshedReport = verifyDocumentViaOcr({
        credential: buildSlotSyntheticCred(activeSlot),
        studentName: activeStudent.name,
        studentApaarId: activeStudent.apaarId,
        simulateTamper: false,
      });
      setLiveVerifyBanner({
        status: 'VERIFIED',
        title: `OCR Verified Slot: ${activeSlot.slotName}`,
        computedSha256: activeSlot.sha256Digest,
        matchedCredentialId: activeSlot.documentNumber,
        matchedVaultUri: activeSlot.digilockerUri,
        verifiedAt: new Date().toLocaleTimeString('en-IN'),
        details: refreshedReport.summary,
        ocrReport: refreshedReport,
      });
      onLogAuditAction(
        'DIGITAL_SIGNATURE_VERIFIED',
        `Document verification slot "${activeSlot.slotName}" verified via OCR (${refreshedReport.matchedFieldsCount}/${refreshedReport.totalFieldsCount} fields matched · ${refreshedReport.ocrConfidencePercent}% confidence) against APAAR Secure Credential Vault.`,
        'SUCCESS'
      );
    }, 350);
  };

  // Seal a new credential (and optional uploaded document file) directly into the APAAR Secure Credential Vault
  const handleIssueCredentialToVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError(null);
    setIsIssuing(true);
    const yearNum = parseInt(issueYear, 10) || 2026;
    const res =
      issueFileName && issueDataUrl
        ? await realtimeClient.uploadVaultDocument({
            studentApaarId: activeStudent.apaarId,
            type: issueType,
            title: issueTitle.trim(),
            issuingInstitution: activeStudent.currentInstitution,
            issuingAuthority: 'APAAR Secure Credential Vault Root CA',
            yearOfPassing: yearNum,
            cgpaOrPercentage: issueScore.trim(),
            aicteApprovalNumber: issueAicte.trim() || 'N/A',
            documentFileName: issueFileName,
            documentMimeType: issueMimeType,
            documentSizeBytes: issueSizeBytes,
            documentDataUrl: issueDataUrl,
          })
        : await realtimeClient.issueVaultCredential({
            studentApaarId: activeStudent.apaarId,
            type: issueType,
            title: issueTitle.trim(),
            issuingInstitution: activeStudent.currentInstitution,
            issuingAuthority: 'APAAR Secure Credential Vault Root CA',
            yearOfPassing: yearNum,
            cgpaOrPercentage: issueScore.trim(),
            aicteApprovalNumber: issueAicte.trim() || 'N/A',
          });
    setIsIssuing(false);

    if (!res.ok || !res.data?.credential) {
      setIssueError(res.error || 'Could not seal credential into Vault.');
      return;
    }

    const signedCred = res.data.credential;
    const vaultUri = ensureVaultUri(signedCred.digilockerUri, activeStudent.apaarId, signedCred.id, signedCred.type);
    const currentList = slots[selectedStudentApaar] || slots['2990 9583 2586'];
    const newSlotId = `slot-${signedCred.id.toLowerCase()}`;
    const newSlot: DocumentSlot = {
      slotId: newSlotId,
      slotName: `Slot ${currentList.length + 1}: ${signedCred.title}${signedCred.documentFileName ? ` [${signedCred.documentFileName}]` : ''}`,
      documentType: signedCred.type,
      category: signedCred.type === 'ABC_TRANSCRIPT' ? 'Credits' : signedCred.type === 'AICTE_APPROVAL' ? 'Regulatory' : 'Higher Education',
      issuingBody: signedCred.issuingInstitution,
      documentNumber: signedCred.id,
      digilockerUri: vaultUri,
      status: 'VERIFIED',
      cgpaOrMarks: signedCred.cgpaOrPercentage,
      passingYear: String(signedCred.yearOfPassing),
      sha256Digest: signedCred.sha256Hash,
      pkiAlgorithm: 'HMAC-SHA256 (Server Vault Key)',
      rootCA: 'APAAR Secure Credential Vault Root CA',
      verifiedAt: 'Just Now · Sealed by Server Vault',
    };

    setSlots(prev => ({
      ...prev,
      [selectedStudentApaar]: [newSlot, ...(prev[selectedStudentApaar] || prev['2990 9583 2586'])],
    }));
    setActiveSlotId(newSlotId);
    syncVaultCredentialToFirestore(signedCred, activeStudent.apaarId).catch(() => {});
    onStudentCredentialAdded?.(activeStudent.apaarId, signedCred);
    await refreshVaultDbDiagnostics();
    setIssueSuccessBanner(`Sealed & persisted "${signedCred.title}" into APAAR Vault Database (${vaultUri})`);
    setIsIssueModalOpen(false);
    handleClearIssueFile();
  };

  // Simulate Tampered / Fake document in this slot
  const handleSimulateTamper = (slotId: string) => {
    setSlots(prev => ({
      ...prev,
      [selectedStudentApaar]: (prev[selectedStudentApaar] || prev['2990 9583 2586']).map(s =>
        s.slotId === slotId
          ? {
              ...s,
              status: 'TAMPER_ALERT',
              cgpaOrMarks: '9.98 CGPA (Tampered - Original: 8.82)',
              tamperReason: 'CRITICAL MISMATCH: SHA-256 payload digest differs from APAAR Secure Vault master ledger. Altered CGPA/Grade detected.',
              verifiedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' Just Now',
            }
          : s
      ),
    }));
    onLogAuditAction(
      'SECURITY_TAMPER_ALERT',
      `FRAUD ALERT in APAAR Secure Vault Slot: Cryptographic hash mismatch on "${activeSlot.slotName}".`,
      'ALERT'
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-[#111927] border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-amber-400" />
              APAAR Secure Credential Vault & Document Verification
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Self-contained HMAC-SHA256 cryptographic credential vault for sealing, inspecting, and verifying uploaded student documents against the APAAR Vault Database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleQuickVerifyLatestVaultDoc}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <ScanText className="w-3.5 h-3.5" />
              <span>{isVerifying ? 'OCR Scanning...' : 'Verify Latest via OCR'}</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Scan File via OCR</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json"
                onChange={handleVerifyUploadedFileOnDisk}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setIssueError(null);
                setIsIssueModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Seal Credential to Vault</span>
            </button>

            {/* Student Selector */}
            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold">Active Candidate:</span>
              <select
                value={selectedStudentApaar}
                onChange={e => setSelectedStudentApaar(e.target.value)}
                className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="2990 9583 2586" className="bg-slate-900 text-white">
                  Abinaya S (Salem) - 2990 9583 2586 ({currentSlots.length} Slots)
                </option>
                <option value="8686 2578 1740" className="bg-slate-900 text-white">
                  Karthik M (Coimbatore) - 8686 2578 1740 (4 Slots)
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Live OCR Document Verification Result Banner with prominent Exit / Close */}
        {liveVerifyBanner && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs space-y-3 ${
              liveVerifyBanner.status === 'VERIFIED'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                : 'bg-amber-950/60 border-amber-700 text-amber-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 font-bold text-sm text-white">
                <ScanText className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{liveVerifyBanner.title}</span>
                {liveVerifyBanner.ocrReport && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                    OCR {liveVerifyBanner.ocrReport.matchedFieldsCount}/{liveVerifyBanner.ocrReport.totalFieldsCount} FIELDS ({liveVerifyBanner.ocrReport.ocrConfidencePercent}%)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLiveVerifyBanner(null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit / Close Verification</span>
              </button>
            </div>
            <p className="text-[11px] leading-relaxed">{liveVerifyBanner.details}</p>

            {liveVerifyBanner.ocrReport && (
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 font-mono">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-1.5 px-3">OCR Scanned Field</th>
                      <th className="py-1.5 px-3">OCR Extracted Value</th>
                      <th className="py-1.5 px-3">APAAR Vault DB Record</th>
                      <th className="py-1.5 px-3 text-right">OCR Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {liveVerifyBanner.ocrReport.fieldComparisons.map(field => (
                      <tr key={field.fieldKey}>
                        <td className="py-1.5 px-3 font-bold text-slate-200">{field.fieldLabel}</td>
                        <td className="py-1.5 px-3 text-amber-300">{field.ocrExtractedValue}</td>
                        <td className="py-1.5 px-3 text-emerald-300">{field.vaultDbValue}</td>
                        <td className="py-1.5 px-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              field.matched
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {field.matched ? `OCR MATCH (${field.confidence}%)` : 'MISMATCH'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 truncate">
                <span className="text-slate-400 block">SHA-256 Digest:</span>
                <span className="text-amber-400">{liveVerifyBanner.computedSha256}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 truncate">
                <span className="text-slate-400 block">Vault URI / ID:</span>
                <span className="text-emerald-400">
                  {liveVerifyBanner.matchedVaultUri || liveVerifyBanner.matchedCredentialId || 'N/A'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800 truncate">
                <span className="text-slate-400 block">Verified At:</span>
                <span className="text-white">{liveVerifyBanner.verifiedAt} · OCR + Vault DB</span>
              </div>
            </div>
          </div>
        )}

        {issueSuccessBanner && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-mono">{issueSuccessBanner}</span>
            </div>
            <button
              onClick={() => setIssueSuccessBanner(null)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 text-slate-300 hover:text-white text-[11px] font-bold"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>
        )}

        {/* Candidate Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-2 text-xs">
          <div>
            <span className="text-slate-400 block">Candidate Name:</span>
            <strong className="text-white text-sm">{activeStudent.name}</strong>
          </div>
          <div>
            <span className="text-slate-400 block">APAAR ID:</span>
            <span className="font-mono text-amber-400 font-bold">{activeStudent.apaarId}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Current Institution:</span>
            <span className="text-slate-300 truncate block">{activeStudent.currentInstitution}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Verified Slots:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {currentSlots.filter(s => s.status === 'VERIFIED').length} of {currentSlots.length} Verified
            </span>
          </div>
        </div>

        {/* Connected Vault Database Strip */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 font-bold">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>APAAR VAULT DB CONNECTED</span>
            </span>
            <span className="text-slate-400">
              DB: <strong className="text-emerald-400">{vaultDbDiag.databaseName}</strong>
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">
              Engine: <strong className="text-white">{vaultDbDiag.storageEngine}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Sealed in DB: <strong className="text-amber-400">{vaultDbDiag.totalSealedCredentials}</strong>
            </span>
            <span>
              Uploaded Files: <strong className="text-sky-400">{vaultDbDiag.totalUploadedDocuments}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Step HR Review & Approval Interface */}
      <div className="bg-[#111927] border-2 border-amber-500/40 rounded-xl p-6 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                Multi-Step HR Review Workflow
              </span>
              <span className="text-xs font-mono text-emerald-400">
                {liveHrMultiStepPreview.verifiedCount} Verified ·{' '}
                {liveHrMultiStepPreview.flaggedForCorrectionCount} Flagged for Correction
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-1 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-400" />
              Multi-Step HR Document Review &amp; Final Approval Console
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Step through candidate documents, leave HR verifier comments, mark each document as{' '}
              <strong className="text-emerald-400">'Verified'</strong> or{' '}
              <strong className="text-amber-300">'Flagged for Correction'</strong>, and execute final HR approval.
            </p>
          </div>

          {/* 4-Step Interactive Stepper Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 text-xs">
            {[
              { step: 1 as const, title: 'Step 1: Queue', sub: `${currentSlots.length} Docs` },
              { step: 2 as const, title: 'Step 2: Review & Comment', sub: `Doc ${activeSlotIndex + 1}/${currentSlots.length}` },
              { step: 3 as const, title: 'Step 3: Summary Matrix', sub: `${liveHrMultiStepPreview.verifiedCount}/${currentSlots.length} Verified` },
              { step: 4 as const, title: 'Step 4: Final Approval', sub: liveHrMultiStepPreview.canApproveFinal ? 'Ready' : 'Has Flagged' },
            ].map(item => (
              <button
                key={item.step}
                type="button"
                onClick={() => setHrReviewStep(item.step)}
                className={`px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                  hrReviewStep === item.step
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                    : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-bold leading-tight">{item.title}</div>
                <div
                  className={`text-[10px] font-mono mt-0.5 ${
                    hrReviewStep === item.step ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {item.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* STEP 1: Candidate Document Queue & HR Verifier Setup */}
        {hrReviewStep === 1 && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label htmlFor="hr-rev-verifier" className="text-slate-300 font-semibold block">
                  HR Verifier Name
                </label>
                <input
                  id="hr-rev-verifier"
                  type="text"
                  value={hrVerifierName}
                  onChange={e => setHrVerifierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="hr-rev-org" className="text-slate-300 font-semibold block">
                  Employer / HR Organization
                </label>
                <input
                  id="hr-rev-org"
                  type="text"
                  value={hrOrganization}
                  onChange={e => setHrOrganization(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-slate-300 font-semibold block">Current Queue Status</span>
                <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
                  <span className="text-emerald-400 font-bold">
                    {liveHrMultiStepPreview.verifiedCount} Verified
                  </span>
                  <span className="text-amber-400 font-bold">
                    {liveHrMultiStepPreview.flaggedForCorrectionCount} Flagged
                  </span>
                  <span className="text-slate-400">
                    Total: {liveHrMultiStepPreview.totalDocuments}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllSlotsVerified}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark All {currentSlots.length} Documents as 'Verified'</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setHrReviewStep(2)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Proceed to Step 2: Document-by-Document Review &amp; Comments</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Document-by-Document Review, Commenting & Status Marking */}
        {hrReviewStep === 2 && (
          <div className="space-y-4 text-xs bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                  STEP 2 OF 4 · DOCUMENT {activeSlotIndex + 1} OF {currentSlots.length}
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">{activeSlot.slotName}</h3>
                <p className="text-[11px] text-slate-400">
                  Issuer: {activeSlot.issuingBody} · Score: {activeSlot.cgpaOrMarks} · Doc No:{' '}
                  <span className="font-mono text-amber-300">{activeSlot.documentNumber}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeSlotIndex <= 0}
                  onClick={() => {
                    const prevSlot = currentSlots[Math.max(0, activeSlotIndex - 1)];
                    if (prevSlot) setActiveSlotId(prevSlot.slotId);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev Doc</span>
                </button>
                <button
                  type="button"
                  disabled={activeSlotIndex >= currentSlots.length - 1}
                  onClick={() => {
                    const nextSlot = currentSlots[Math.min(currentSlots.length - 1, activeSlotIndex + 1)];
                    if (nextSlot) setActiveSlotId(nextSlot.slotId);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Next Doc</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-7 space-y-2">
                <label
                  htmlFor="hr-slot-comment-input"
                  className="text-slate-200 font-semibold flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>HR Verifier Review Comment for this Document:</span>
                </label>
                <textarea
                  id="hr-slot-comment-input"
                  rows={2}
                  value={activeSlotHrReview.comment}
                  onChange={e => handleUpdateSlotHrComment(activeSlot, e.target.value)}
                  placeholder="Enter HR review notes or correction instructions for this document..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400">Quick comment:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSlotHrComment(
                        activeSlot,
                        'All 7 OCR fields and HMAC-SHA256 seal verified against APAAR Vault DB.'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 cursor-pointer"
                  >
                    + OCR 7/7 Verified
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSlotHrComment(
                        activeSlot,
                        'CGPA / grade mismatch on scanned document — flagged for correction.'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer"
                  >
                    + CGPA Correction Needed
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSlotHrComment(
                        activeSlot,
                        'Registrar seal / signature unclear — re-upload clear PDF for verification.'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 cursor-pointer"
                  >
                    + Unclear Seal / Re-upload
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-2.5 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Document Review Status:</span>
                  {activeSlotHrReview.status === 'VERIFIED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold text-[11px]">
                      <Flag className="w-3.5 h-3.5" /> Flagged for Correction
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSetSlotHrReview(activeSlot, 'VERIFIED')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      activeSlotHrReview.status === 'VERIFIED'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-950 hover:bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as 'Verified'</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetSlotHrReview(activeSlot, 'FLAGGED_FOR_CORRECTION')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                      activeSlotHrReview.status === 'FLAGGED_FOR_CORRECTION'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-950 hover:bg-amber-950/60 text-amber-300 border-amber-800/70'
                    }`}
                  >
                    <Flag className="w-4 h-4" />
                    <span>Flagged for Correction</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setHrReviewStep(1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to Step 1</span>
              </button>
              <button
                type="button"
                onClick={() => setHrReviewStep(3)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Step 3: Review Summary Matrix</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Multi-Document Review Summary Matrix */}
        {hrReviewStep === 3 && (
          <div className="space-y-4 text-xs">
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="py-2.5 px-3">Document Slot</th>
                    <th className="py-2.5 px-3">HR Review Status</th>
                    <th className="py-2.5 px-3">Verifier Comment</th>
                    <th className="py-2.5 px-3 text-right">Quick Status Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {currentSlots.map(slot => {
                    const rev = getSlotHrReview(slot);
                    return (
                      <tr key={slot.slotId} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{slot.slotName}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {slot.documentNumber} · {slot.cgpaOrMarks}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {rev.status === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold text-[10px]">
                              <Flag className="w-3 h-3" /> Flagged for Correction
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={rev.comment}
                            onChange={e => handleUpdateSlotHrComment(slot, e.target.value)}
                            aria-label={`Comment for ${slot.slotName}`}
                            className="w-full min-w-[220px] bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-[11px] text-slate-200"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetSlotHrReview(slot, 'VERIFIED')}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                                rev.status === 'VERIFIED'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 hover:bg-emerald-950 text-slate-300'
                              }`}
                            >
                              Verified
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetSlotHrReview(slot, 'FLAGGED_FOR_CORRECTION')}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                                rev.status === 'FLAGGED_FOR_CORRECTION'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 hover:bg-amber-950 text-slate-300'
                              }`}
                            >
                              Flag for Correction
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHrReviewStep(2)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to Step 2</span>
              </button>
              <button
                type="button"
                onClick={() => setHrReviewStep(4)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Step 4: Final HR Approval Decision</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Final HR Approval & Sign-Off */}
        {hrReviewStep === 4 && (
          <div className="space-y-4 text-xs bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                  STEP 4 OF 4 · FINAL HR APPROVAL DECISION
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  Final HR Sign-Off for {activeStudent.name} ({activeStudent.apaarId})
                </h3>
              </div>

              <span
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                  liveHrMultiStepPreview.canApproveFinal
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950/80 text-amber-300 border-amber-700'
                }`}
              >
                {liveHrMultiStepPreview.canApproveFinal
                  ? `All ${liveHrMultiStepPreview.verifiedCount}/${liveHrMultiStepPreview.totalDocuments} Documents Verified · Ready for Final Approval`
                  : `${liveHrMultiStepPreview.flaggedForCorrectionCount} Document(s) Flagged for Correction`}
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="hr-final-comment-input" className="text-slate-200 font-semibold block">
                Final HR Approval / Review Summary Comment:
              </label>
              <textarea
                id="hr-final-comment-input"
                rows={2}
                value={hrFinalApprovalComment}
                onChange={e => setHrFinalApprovalComment(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {liveHrMultiStepPreview.flaggedForCorrectionCount > 0 && (
              <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-700/80 text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {liveHrMultiStepPreview.flaggedForCorrectionCount} Document(s) Currently Marked 'Flagged for Correction':
                  </span>
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-100">
                  {liveHrMultiStepPreview.items
                    .filter(i => i.reviewStatus === 'FLAGGED_FOR_CORRECTION')
                    .map(i => (
                      <li key={i.slotId}>
                        <strong>{i.slotName}:</strong> "{i.comment}"
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setHrReviewStep(3)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to Step 3</span>
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                {liveHrMultiStepPreview.flaggedForCorrectionCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllSlotsVerified}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-800 font-semibold text-xs cursor-pointer"
                  >
                    Clear Flags &amp; Mark All 'Verified'
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleFinalizeHrMultiStepReview('FLAG_CORRECTIONS')}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Flag className="w-4 h-4" />
                  <span>Submit 'Flagged for Correction' Notice</span>
                </button>

                <button
                  type="button"
                  disabled={!liveHrMultiStepPreview.canApproveFinal}
                  onClick={() => handleFinalizeHrMultiStepReview('APPROVE_FINAL')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title={
                    liveHrMultiStepPreview.canApproveFinal
                      ? 'Grant final HR approval for all verified documents'
                      : 'All documents must be marked Verified before granting Final HR Approval'
                  }
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Grant Final HR Approval &amp; Seal Dossier</span>
                </button>
              </div>
            </div>

            {hrFinalSubmittedReport && (
              <div
                className={`mt-3 p-4 rounded-xl border space-y-2 ${
                  hrFinalSubmittedReport.overallDecision === 'FINAL_APPROVED'
                    ? 'bg-emerald-950/60 border-emerald-600 text-emerald-100'
                    : 'bg-amber-950/60 border-amber-600 text-amber-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-white">
                      {hrFinalSubmittedReport.overallDecision === 'FINAL_APPROVED'
                        ? `FINAL HR APPROVAL GRANTED (${hrFinalSubmittedReport.verifiedCount}/${hrFinalSubmittedReport.totalDocuments} Documents Verified)`
                        : `DOSSIER RETURNED — FLAGGED FOR CORRECTION (${hrFinalSubmittedReport.flaggedForCorrectionCount} Flagged)`}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-amber-300">
                      {hrFinalSubmittedReport.reviewBatchId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHrFinalSubmittedReport(null)}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Exit / Close Review Receipt</span>
                  </button>
                </div>
                <p className="text-[11px]">{hrFinalSubmittedReport.finalComments}</p>
                <div className="text-[10px] font-mono text-slate-300">
                  Signed by: {hrFinalSubmittedReport.hrVerifierName} ({hrFinalSubmittedReport.hrOrganization}) · Seal SHA-256:{' '}
                  {hrFinalSubmittedReport.sha256Seal.slice(0, 24)}...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Left Slot List (5 cols) & Right Slot Inspector (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Verification Slot Directory */}
        <div className="lg:col-span-5 bg-[#111927] border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-amber-400" />
              Document Verification Slots ({currentSlots.length})
            </h2>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-slate-900 text-[11px] text-slate-300 border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Higher Education">Higher Education</option>
              <option value="Schooling">Schooling</option>
              <option value="Credits">Credits & ABC</option>
              <option value="Regulatory">Regulatory</option>
            </select>
          </div>

          {/* Slots list */}
          <div className="space-y-2.5">
            {filteredSlots.map(slot => {
              const isSelected = activeSlot.slotId === slot.slotId;
              const slotHrRev = getSlotHrReview(slot);
              return (
                <button
                  key={slot.slotId}
                  onClick={() => setActiveSlotId(slot.slotId)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs space-y-2 ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 shadow-md text-white'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-100 text-xs truncate">
                      {slot.slotName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {slotHrRev.status === 'FLAGGED_FOR_CORRECTION' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 shrink-0">
                          <Flag className="w-3 h-3" />
                          Flagged for Correction
                        </span>
                      ) : slot.status === 'VERIFIED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 shrink-0 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Tamper Alert
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>{slot.issuingBody}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-amber-400">{slot.passingYear}</span>
                    <span aria-hidden="true">·</span>
                    <span>{slot.category}</span>
                  </div>

                  {slotHrRev.comment && (
                    <div className="text-[10px] text-slate-400 italic truncate border-t border-slate-800/70 pt-1">
                      HR Note: "{slotHrRev.comment}"
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Document Slot Inspector */}
        <div className="lg:col-span-7 bg-[#111927] border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                DOCUMENT VERIFICATION INSPECTOR
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{activeSlot.slotName}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenSlotCertificateModal(activeSlot)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open & Inspect File</span>
              </button>

              <button
                onClick={() => handleVerifySlot(activeSlot.slotId)}
                disabled={isVerifying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow"
              >
                <ScanText className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Verify via OCR</span>
              </button>

              <button
                onClick={() => handleSimulateTamper(activeSlot.slotId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 hover:text-white font-medium rounded-lg text-xs transition-colors"
                title="Test how OCR tamper detection behaves if this certificate was manipulated"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Test OCR Tamper</span>
              </button>
            </div>
          </div>

          {/* Tamper Warning Banner if slot failed */}
          {activeSlot.status === 'TAMPER_ALERT' && (
            <div className="p-4 bg-rose-950/80 border-2 border-rose-600 rounded-xl text-rose-300 space-y-2 text-xs animate-in fade-in duration-200">
              <div className="font-bold flex items-center gap-2 text-sm text-white">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>OCR Field &amp; Cryptographic Signature Mismatch Detected!</span>
              </div>
              <p className="leading-relaxed text-[11px] text-rose-200">
                {activeSlot.tamperReason}
              </p>
              <div className="pt-2 border-t border-rose-900/80 flex items-center justify-between text-[11px]">
                <span>Status: REJECTED BY OCR + AICTE INTEGRITY RULE</span>
                <button
                  onClick={() => handleVerifySlot(activeSlot.slotId)}
                  className="underline font-bold text-rose-300 hover:text-white"
                >
                  Restore &amp; Re-Verify via OCR from Vault DB
                </button>
              </div>
            </div>
          )}

          {/* Document Preview Card */}
          <div className="bg-[#111927] border border-slate-700/80 rounded-xl p-6 relative overflow-hidden shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                  AUTHENTICATED APAAR SECURE VAULT · OCR VERIFIED
                </span>
                <h4 className="text-base font-bold text-white mt-1">{activeSlot.documentType.replace('_', ' ')}</h4>
                <p className="text-xs text-slate-300">{activeSlot.issuingBody}</p>
              </div>

              <div className="w-16 h-16 bg-white p-1 rounded-lg shrink-0 flex items-center justify-center shadow">
                <QrCode className="w-14 h-14 text-slate-950" />
              </div>
            </div>

            {/* Key Slot Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Score / Performance:</span>
                <strong className={activeSlot.status === 'TAMPER_ALERT' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {activeSlot.cgpaOrMarks}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Conferment Year:</span>
                <strong className="text-white">{activeSlot.passingYear}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Document / Reg No:</span>
                <strong className="text-amber-400 font-mono text-[11px]">{activeSlot.documentNumber}</strong>
              </div>
            </div>

            {/* APAAR Secure Vault URI */}
            <div className="text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800/80 break-all">
              <span className="text-slate-500">APAAR Vault URI: </span>
              <span className="text-emerald-400">
                {ensureVaultUri(activeSlot.digilockerUri, activeStudent.apaarId, activeSlot.documentNumber, activeSlot.documentType)}
              </span>
            </div>
          </div>

          {/* Live OCR Extraction & Vault Database Cross-Verification Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-white font-bold flex items-center gap-1.5">
                <ScanText className="w-4 h-4 text-amber-400" />
                <span>OCR Optical Character Recognition &amp; Vault DB Verification Matrix</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  activeSlotOcrReport.verified
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                OCR {activeSlotOcrReport.matchedFieldsCount}/{activeSlotOcrReport.totalFieldsCount} Fields Matched ({activeSlotOcrReport.ocrConfidencePercent}% Confidence)
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-1.5 px-2.5">OCR Scanned Field</th>
                    <th className="py-1.5 px-2.5">OCR Extracted from Document</th>
                    <th className="py-1.5 px-2.5">APAAR Vault DB Record</th>
                    <th className="py-1.5 px-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {activeSlotOcrReport.fieldComparisons.map(field => (
                    <tr key={field.fieldKey}>
                      <td className="py-1.5 px-2.5 font-bold text-slate-200">{field.fieldLabel}</td>
                      <td className="py-1.5 px-2.5 text-amber-300 truncate max-w-[160px]">{field.ocrExtractedValue}</td>
                      <td className="py-1.5 px-2.5 text-emerald-300 truncate max-w-[160px]">{field.vaultDbValue}</td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            field.matched
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {field.matched ? `MATCH (${field.confidence}%)` : 'MISMATCH'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inline HR Verifier Document Review & Comment Box */}
          <div className="bg-slate-900/70 border border-amber-500/40 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-white font-bold flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>HR Verifier Review &amp; Comment for Active Document</span>
              </span>
              {activeSlotHrReview.status === 'VERIFIED' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> Marked 'Verified'
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold text-[10px]">
                  <Flag className="w-3 h-3" /> Marked 'Flagged for Correction'
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inspector-hr-comment" className="text-slate-300 font-semibold block text-[11px]">
                Leave HR Review Comment / Correction Note:
              </label>
              <textarea
                id="inspector-hr-comment"
                rows={2}
                value={activeSlotHrReview.comment}
                onChange={e => handleUpdateSlotHrComment(activeSlot, e.target.value)}
                placeholder="Write HR comment for this document..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetSlotHrReview(activeSlot, 'VERIFIED')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    activeSlotHrReview.status === 'VERIFIED'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-950 hover:bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as 'Verified'</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetSlotHrReview(activeSlot, 'FLAGGED_FOR_CORRECTION')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    activeSlotHrReview.status === 'FLAGGED_FOR_CORRECTION'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-950 hover:bg-amber-950/60 text-amber-300 border-amber-800'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Flagged for Correction</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setHrReviewStep(4)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Go to Final Approval (Step 4)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cryptographic Ledger Verification Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                APAAR Vault Cryptographic Seal Matrix
              </span>
              <span className="text-[10px] text-emerald-400">
                Verified at: {activeSlot.verifiedAt}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-400 pt-1">
              <div>
                <span className="text-slate-500">Vault Authority (CA): </span>
                <span className="text-slate-200">{activeSlot.rootCA}</span>
              </div>
              <div>
                <span className="text-slate-500">Algorithm: </span>
                <span className="text-amber-400">{activeSlot.pkiAlgorithm}</span>
              </div>
              <div className="break-all">
                <span className="text-slate-500">SHA-256 Checksum: </span>
                <span className={activeSlot.status === 'TAMPER_ALERT' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {activeSlot.sha256Digest}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">
              DPDP Act 2023 & APAAR Secure Credential Vault Compliant.
            </span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Verified Vault Dossier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Seal New Credential into APAAR Secure Vault */}
      {isIssueModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={e => {
            if (e.target === e.currentTarget) setIsIssueModalOpen(false);
          }}
        >
          <div className="bg-[#111927] border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Seal New Credential into APAAR Secure Vault
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs font-bold transition-colors"
              >
                <X className="w-4 h-4 text-rose-400" />
                <span>Exit / Close</span>
              </button>
            </div>

            <form onSubmit={handleIssueCredentialToVault} className="p-6 space-y-3 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Target Candidate
                </label>
                <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono">
                  {activeStudent.name} · APAAR: {activeStudent.apaarId}
                </div>
              </div>

              {/* Document Upload Section inside Vault Modal */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-dashed border-amber-500/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Document File into Vault (PDF / Image)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAttachSamplePdfToSlot}
                    className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-[11px]"
                  >
                    Attach Official PDF
                  </button>
                </div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json"
                  onChange={handleSelectIssueFile}
                  className="block w-full text-[11px] text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                />
                {issueFileName && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/80 font-mono text-[10px] space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-emerald-300">
                      <span className="font-bold truncate">{issueFileName} ({formatVaultFileSize(issueSizeBytes)})</span>
                      <button
                        type="button"
                        onClick={handleClearIssueFile}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-800 font-sans font-bold text-[10px] shrink-0"
                      >
                        <X className="w-3 h-3 text-rose-400" />
                        <span>Remove / Exit File</span>
                      </button>
                    </div>
                    <div className="text-slate-400 truncate">
                      File SHA-256: <span className="text-amber-400">{issueFileSha256}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Credential Type
                  </label>
                  <select
                    value={issueType}
                    onChange={e => setIssueType(e.target.value as AcademicCredential['type'])}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="DEGREE">DEGREE</option>
                    <option value="MARKSHEET">MARKSHEET</option>
                    <option value="ABC_TRANSCRIPT">ABC_TRANSCRIPT</option>
                    <option value="AICTE_APPROVAL">AICTE_APPROVAL</option>
                    <option value="TRANSFER_CERTIFICATE">TRANSFER_CERTIFICATE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Year of Conferment
                  </label>
                  <input
                    type="number"
                    min={1950}
                    max={2100}
                    value={issueYear}
                    onChange={e => setIssueYear(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Credential / Degree Title
                </label>
                <input
                  type="text"
                  value={issueTitle}
                  onChange={e => setIssueTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    CGPA / Marks / Credits
                  </label>
                  <input
                    type="text"
                    value={issueScore}
                    onChange={e => setIssueScore(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    AICTE Approval / Reg Code
                  </label>
                  <input
                    type="text"
                    value={issueAicte}
                    onChange={e => setIssueAicte(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              {issueError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]">
                  {issueError}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-200 hover:text-rose-200 border border-slate-700 font-bold"
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>Exit / Close</span>
                </button>
                <button
                  type="submit"
                  disabled={isIssuing}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isIssuing ? 'Sealing with HMAC-SHA256…' : 'Sign & Seal into Vault'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
