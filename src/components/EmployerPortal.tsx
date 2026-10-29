/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Student,
  VerificationRequest,
  AcademicCredential,
} from '../types';
import { formatApaarId, validateApaarId } from '../utils/verificationEngine';
import {
  buildHrVerificationDecisionReport,
  HrVerificationDecisionReport,
  VaultOcrVerificationReport,
  ensureVaultUri,
} from '../utils/vaultEngine';
import { realtimeClient } from '../services/realtimeClient';
import { ApaarQrScannerModal } from './ApaarQrScannerModal';
import {
  ShieldCheck,
  Building2,
  FileCheck2,
  Send,
  AlertTriangle,
  QrCode,
  CheckCircle2,
  Lock,
  Clock,
  Ban,
  ArrowRight,
  ExternalLink,
  Cpu,
  Eye,
  Zap,
  X,
  ScanText,
  Upload,
  UserCheck,
  FileWarning,
  RefreshCw,
  Database,
} from 'lucide-react';

interface EmployerPortalProps {
  students: Student[];
  requests: VerificationRequest[];
  onSubmitRequest: (params: {
    employerName: string;
    verifierName: string;
    verifierEmail: string;
    studentApaarId: string;
    requestedCredentials: AcademicCredential['type'][];
    purpose: string;
  }) => { success: boolean; error?: string; requestId?: string };
  onSimulateConsentApproval: (requestId: string) => void;
  onExecuteBackendValidation: (requestId: string, simulateTamper?: boolean) => void;
  onHrRequestUpdated?: (updatedRequest: VerificationRequest) => void;
  onViewAuditTrail: (requestId?: string) => void;
  onViewCertificateDetails: (credential: AcademicCredential) => void;
  onSwitchToStudentView: () => void;
}

export const EmployerPortal: React.FC<EmployerPortalProps> = ({
  students,
  requests,
  onSubmitRequest,
  onSimulateConsentApproval,
  onExecuteBackendValidation,
  onHrRequestUpdated,
  onViewAuditTrail,
  onViewCertificateDetails,
  onSwitchToStudentView,
}) => {
  // Form fields
  const [employerName, setEmployerName] = useState('Tata Consultancy Services');
  const [verifierName, setVerifierName] = useState('Kavitha Ramachandran');
  const [verifierEmail, setVerifierEmail] = useState('kavitha.demo@tcs.example.com');
  const [apaarInput, setApaarInput] = useState('2990 9583 2586');
  const [purpose, setPurpose] = useState(
    'Pre-Employment Background Verification for Systems Engineer (Req #TCS-2026-CHN)'
  );
  const [selectedCredTypes, setSelectedCredTypes] = useState<AcademicCredential['type'][]>([
    'DEGREE',
    'MARKSHEET',
    'AICTE_APPROVAL',
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    requests.length > 0 ? requests[0].id : ''
  );
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanSuccessToast, setQrScanSuccessToast] = useState<{
    studentName: string;
    apaarId: string;
    requestId?: string;
  } | null>(null);

  // Active request currently selected in employer view
  const activeRequest = requests.find(r => r.id === selectedRequestId) || requests[0];
  const targetStudent = activeRequest
    ? students.find(s => s.apaarId === activeRequest.studentApaarId) || students[0]
    : students.find(s => s.apaarId === apaarInput) || students[0];

  // HR Active Verification Workbench State
  const [hrSelectedStudentApaar, setHrSelectedStudentApaar] = useState<string>(
    activeRequest?.studentApaarId || '2990 9583 2586'
  );
  const hrCandidate =
    students.find(s => s.apaarId === hrSelectedStudentApaar) ||
    targetStudent ||
    students[0];

  const [hrSelectedCredentialId, setHrSelectedCredentialId] = useState<string>(
    hrCandidate?.credentials[0]?.id || ''
  );
  const [hrRemarksInput, setHrRemarksInput] = useState<string>(
    'Verified all 7 OCR fields and HMAC-SHA256 seal against APAAR Vault DB. Cleared for HR onboarding.'
  );
  const [isHrVerifying, setIsHrVerifying] = useState(false);
  const [hrVerificationResult, setHrVerificationResult] = useState<{
    hrReport: HrVerificationDecisionReport;
    ocrReport: VaultOcrVerificationReport;
    sourceLabel: string;
  } | null>(null);
  const [showHrRawOcrText, setShowHrRawOcrText] = useState(false);
  const hrFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync HR selected candidate/credential when active request changes
  useEffect(() => {
    if (activeRequest?.studentApaarId) {
      setHrSelectedStudentApaar(activeRequest.studentApaarId);
      const stu = students.find(s => s.apaarId === activeRequest.studentApaarId);
      if (stu && stu.credentials.length > 0) {
        setHrSelectedCredentialId(stu.credentials[0].id);
      }
    }
  }, [activeRequest?.id, activeRequest?.studentApaarId, students]);

  const handleApaarChange = (val: string) => {
    setApaarInput(formatApaarId(val));
    setFormError(null);
  };

  const handleToggleCredType = (type: AcademicCredential['type']) => {
    setSelectedCredTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateApaarId(apaarInput);
    if (!validation.isValid) {
      setFormError(validation.error || 'Invalid APAAR ID');
      return;
    }

    const res = onSubmitRequest({
      employerName,
      verifierName,
      verifierEmail,
      studentApaarId: apaarInput,
      requestedCredentials: selectedCredTypes,
      purpose,
    });

    if (!res.success) {
      setFormError(res.error || 'Failed to submit request.');
    } else if (res.requestId) {
      setSelectedRequestId(res.requestId);
      setFormError(null);
    }
  };

  /**
   * Executes Active HR OCR + Cryptographic Vault Verification and optionally updates
   * the active BGV Request in the database with HR's official decision.
   */
  const handleRunHrActiveVerification = async (options?: {
    credential?: AcademicCredential;
    student?: Student;
    requestId?: string;
    hrDecision?: 'APPROVE' | 'REJECT' | 'AUTO';
    simulateTamper?: boolean;
    uploadedFile?: {
      fileName: string;
      mimeType: string;
      dataUrl: string;
    };
  }) => {
    const stu = options?.student || hrCandidate;
    if (!stu) return;
    const cred =
      options?.credential ||
      stu.credentials.find(c => c.id === hrSelectedCredentialId) ||
      stu.credentials[0];
    if (!cred) return;

    const reqForStudent =
      options?.requestId
        ? requests.find(r => r.id === options.requestId)
        : activeRequest && activeRequest.studentApaarId === stu.apaarId
        ? activeRequest
        : requests.find(r => r.studentApaarId === stu.apaarId);

    const decision = options?.hrDecision || 'AUTO';
    const simulateTamper = Boolean(options?.simulateTamper) || decision === 'REJECT';
    const sourceLabel =
      options?.uploadedFile?.fileName || cred.documentFileName || cred.title;

    setIsHrVerifying(true);
    try {
      const res = await realtimeClient.hrVerifyCandidateDocument({
        requestId: reqForStudent?.id,
        studentApaarId: stu.apaarId,
        credentialId: cred.id,
        hrVerifierName: verifierName,
        hrOrganization: employerName,
        hrRemarks: hrRemarksInput,
        hrDecision: decision,
        fileName: options?.uploadedFile?.fileName,
        mimeType: options?.uploadedFile?.mimeType,
        dataUrl: options?.uploadedFile?.dataUrl,
        simulateTamper,
      });

      if (res.ok && res.data?.hrReport) {
        setHrVerificationResult({
          hrReport: res.data.hrReport,
          ocrReport: res.data.ocrReport,
          sourceLabel,
        });
        if (res.data.updatedRequest && onHrRequestUpdated) {
          onHrRequestUpdated(res.data.updatedRequest);
        }
      } else {
        const localHrReport = buildHrVerificationDecisionReport({
          credential: cred,
          studentName: stu.name,
          studentApaarId: stu.apaarId,
          hrVerifierName: verifierName,
          hrOrganization: employerName,
          hrRemarks: hrRemarksInput,
          hrDecision: decision,
          uploadedDataUrl: options?.uploadedFile?.dataUrl,
          uploadedFileName: options?.uploadedFile?.fileName,
          simulateTamper,
        });
        setHrVerificationResult({
          hrReport: localHrReport,
          ocrReport: localHrReport.ocrReport,
          sourceLabel,
        });
        if (reqForStudent && onHrRequestUpdated) {
          onHrRequestUpdated({
            ...reqForStudent,
            status: localHrReport.finalRequestStatus,
            consentGrantedAt: reqForStudent.consentGrantedAt || localHrReport.verifiedAt,
            backendValidation: {
              repositoryChecked: 'APAAR Secure Credential Vault',
              signatureAlgorithm: 'HMAC-SHA256',
              certificateSerial: cred.issuerCertificateSerial || 'APAAR-SERVER-HMAC-SHA256',
              issuerCA: 'APAAR Secure Credential Vault Root CA',
              sha256Digest: localHrReport.ocrReport.computedSha256,
              verifiedAt: localHrReport.verifiedAt,
              isTampered: !localHrReport.verified,
              tamperDetails: !localHrReport.verified ? localHrReport.hrRemarks : undefined,
              networkLatencyMs: 18,
              hrVerifiedBy: localHrReport.hrVerifierName,
              hrOrganization: localHrReport.hrOrganization,
              hrRemarks: localHrReport.hrRemarks,
              ocrConfidencePercent: localHrReport.ocrReport.ocrConfidencePercent,
              ocrMatchedFields: `${localHrReport.ocrReport.matchedFieldsCount}/${localHrReport.ocrReport.totalFieldsCount}`,
            },
          });
        }
      }
    } finally {
      setIsHrVerifying(false);
    }
  };

  const handleHrFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        handleRunHrActiveVerification({
          hrDecision: 'APPROVE',
          uploadedFile: {
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            dataUrl,
          },
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Compact HR Verification Header */}
      <div className="bg-[#111927] border border-slate-800 rounded-xl px-5 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              HR Candidate Check & OCR Document Verification
            </h1>
            <p className="text-xs text-slate-400">
              Select a student or upload a certificate file below to verify via 7-field OCR & APAAR Vault DB.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vault DB + 7-Field OCR Ready</span>
          </span>
        </div>
      </div>

      {/* HR Active Document & OCR Verification Workbench (HR Checking + Direct Verification) */}
      <div className="bg-[#111927] border-2 border-amber-500/40 rounded-xl p-6 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                HR Active Verification Engine
              </span>
              <span className="text-xs font-mono text-emerald-400">
                7-Field OCR + APAAR Vault DB Cross-Check
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-1 flex items-center gap-2">
              <ScanText className="w-5 h-5 text-amber-400" />
              HR Checking & Active Document Verification Workbench
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              HR can directly verify candidate Vault credentials or upload candidate-submitted PDF/Image certificates to perform live 7-field OCR verification and record official HR approval.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleRunHrActiveVerification({
                  hrDecision: 'APPROVE',
                })
              }
              disabled={isHrVerifying}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {isHrVerifying
                  ? 'Running HR OCR Verification...'
                  : 'HR Verify & Approve via OCR'}
              </span>
            </button>

            <input
              ref={hrFileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleHrFileUploadChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => hrFileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Candidate File for HR OCR Check</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleRunHrActiveVerification({
                  hrDecision: 'REJECT',
                  simulateTamper: true,
                })
              }
              disabled={isHrVerifying}
              className="px-3 py-2 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Simulate tampered document or flag HR discrepancy"
            >
              <FileWarning className="w-4 h-4 text-rose-400" />
              <span>Flag Discrepancy / Tamper Test</span>
            </button>
          </div>
        </div>

        {/* Candidate, Credential & HR Verifier Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <label htmlFor="hr-candidate-select" className="text-slate-300 font-semibold block">
              1. Select Candidate to Verify (APAAR Vault DB)
            </label>
            <select
              id="hr-candidate-select"
              value={hrSelectedStudentApaar}
              onChange={e => {
                const nextApaar = e.target.value;
                setHrSelectedStudentApaar(nextApaar);
                const nextStu = students.find(s => s.apaarId === nextApaar);
                if (nextStu && nextStu.credentials.length > 0) {
                  setHrSelectedCredentialId(nextStu.credentials[0].id);
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {students.map(s => (
                <option key={s.apaarId} value={s.apaarId}>
                  {s.name} — APAAR: {s.apaarId} ({s.credentials.length} Vault Docs)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="hr-credential-select" className="text-slate-300 font-semibold block">
              2. Select Credential / Document for OCR Scan
            </label>
            <select
              id="hr-credential-select"
              value={hrSelectedCredentialId}
              onChange={e => setHrSelectedCredentialId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {(hrCandidate?.credentials || []).map(c => (
                <option key={c.id} value={c.id}>
                  [{c.type}] {c.title} ({c.cgpaOrPercentage})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="hr-remarks-input" className="text-slate-300 font-semibold block">
              3. HR Verification Remarks / Compliance Sign-Off Note
            </label>
            <input
              id="hr-remarks-input"
              type="text"
              value={hrRemarksInput}
              onChange={e => setHrRemarksInput(e.target.value)}
              placeholder="Enter HR compliance remarks..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Live HR OCR & Vault Verification Report */}
        {hrVerificationResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-3 ${
              hrVerificationResult.hrReport.verified
                ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-100'
                : 'bg-rose-950/40 border-rose-600/80 text-rose-100'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {hrVerificationResult.hrReport.verified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-bold text-white">
                  {hrVerificationResult.hrReport.verified
                    ? `HR VERIFIED & APPROVED IN VAULT DB: "${hrVerificationResult.sourceLabel}"`
                    : `HR FLAGGED DISCREPANCY / TAMPER DETECTED: "${hrVerificationResult.sourceLabel}"`}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                  OCR {hrVerificationResult.ocrReport.matchedFieldsCount}/
                  {hrVerificationResult.ocrReport.totalFieldsCount} FIELDS MATCHED (
                  {hrVerificationResult.ocrReport.ocrConfidencePercent}% CONFIDENCE)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px]">
                  {hrVerificationResult.hrReport.hrVerificationId}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHrRawOcrText(prev => !prev)}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] cursor-pointer"
                >
                  {showHrRawOcrText ? 'Hide Raw OCR Text' : 'Show Raw OCR Text'}
                </button>
                <button
                  type="button"
                  onClick={() => setHrVerificationResult(null)}
                  className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Exit / Close HR Verification</span>
                </button>
              </div>
            </div>

            {/* HR Sign-off metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">HR Verifier & Organization:</span>
                <strong className="text-white">
                  {hrVerificationResult.hrReport.hrVerifierName} ·{' '}
                  {hrVerificationResult.hrReport.hrOrganization}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Candidate & APAAR ID:</span>
                <strong className="text-amber-400 font-mono">
                  {hrVerificationResult.hrReport.studentName} (
                  {hrVerificationResult.hrReport.studentApaarId})
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">HR Compliance Remarks:</span>
                <span className="text-slate-200">{hrVerificationResult.hrReport.hrRemarks}</span>
              </div>
            </div>

            {/* 7-Field OCR vs APAAR Vault DB Comparison Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/90">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/90">
                    <th className="py-2 px-3 font-semibold">OCR Field</th>
                    <th className="py-2 px-3 font-semibold">Candidate Document (OCR Scanned)</th>
                    <th className="py-2 px-3 font-semibold">APAAR Vault DB Master Value</th>
                    <th className="py-2 px-3 font-semibold text-right">HR Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {hrVerificationResult.ocrReport.fieldComparisons.map(f => (
                    <tr key={f.fieldKey}>
                      <td className="py-1.5 px-3 font-semibold text-slate-200">{f.fieldLabel}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-300">{f.ocrExtractedValue}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-400">{f.vaultDbValue}</td>
                      <td className="py-1.5 px-3 text-right">
                        {f.matched ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> MATCH ({f.confidence}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" /> MISMATCH
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showHrRawOcrText && (
              <pre className="p-3 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-800">
                {hrVerificationResult.ocrReport.extractedRawText}
              </pre>
            )}

            {/* Direct HR Action Buttons inside the Report */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-mono">
                Vault URI: {hrVerificationResult.ocrReport.vaultUri} · SHA-256:{' '}
                {hrVerificationResult.ocrReport.computedSha256.slice(0, 20)}...
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleRunHrActiveVerification({
                      hrDecision: 'APPROVE',
                      simulateTamper: false,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Seal HR Verification</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRunHrActiveVerification({
                      hrDecision: 'REJECT',
                      simulateTamper: true,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Reject / Flag Tampered Document</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column (5 cols): Step 1 Initiation Form */}
        <div className="lg:col-span-5 bg-[#111927] border border-slate-800 rounded-xl p-6 shadow-md space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Step 1: Initiate Background Verification Request
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan candidate's physical APAAR card or enter 12-digit ID to dispatch an authenticated verification petition.
              </p>
            </div>
          </div>

          {/* Optical QR Scanner Quick Action Banner */}
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="w-full p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/20 hover:from-amber-500/25 hover:to-amber-500/25 text-amber-300 border-2 border-amber-500/50 hover:border-amber-400 rounded-xl font-bold flex items-center justify-between transition-all group shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Scan Physical APAAR Card QR</span>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-extrabold flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5" />
                    Auto BGV
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-normal">
                  Live camera scanning or interactive physical card deck
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              <span className="hidden sm:inline">Launch Scanner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* QR Scan Success Toast */}
          {qrScanSuccessToast && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-600 text-emerald-200 rounded-lg flex items-start justify-between gap-2 text-xs animate-in fade-in">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">
                    Physical Card Scanned: {qrScanSuccessToast.studentName}
                  </span>
                  <div className="text-[11px] text-emerald-300 font-mono mt-0.5">
                    APAAR ID {qrScanSuccessToast.apaarId} loaded.{' '}
                    {qrScanSuccessToast.requestId
                      ? `BGV Request #${qrScanSuccessToast.requestId} automatically dispatched.`
                      : 'Candidate details prefilled.'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrScanSuccessToast(null)}
                className="text-emerald-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Candidate APAAR ID input with inline Scan QR button */}
            <div className="space-y-1.5">
              <label htmlFor="apaar-input" className="text-slate-300 font-semibold block">
                Candidate 12-Digit APAAR ID <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="apaar-input"
                  type="text"
                  value={apaarInput}
                  onChange={e => handleApaarChange(e.target.value)}
                  placeholder="XXXX XXXX XXXX"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-24 py-2 text-sm text-amber-400 font-mono tracking-wider focus:outline-none focus:border-amber-500"
                  maxLength={14}
                />
                <button
                  type="button"
                  onClick={() => setIsQrScannerOpen(true)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Scan physical APAAR card with camera or card deck"
                >
                  <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Scan QR</span>
                </button>
              </div>
              {/* Dynamic Quick load chips including newly created students */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                <span>Quick pick candidate:</span>
                {students.slice(0, 5).map(s => (
                  <button
                    key={s.apaarId}
                    type="button"
                    onClick={() => {
                      handleApaarChange(s.apaarId);
                      setHrSelectedStudentApaar(s.apaarId);
                      if (s.credentials.length > 0) {
                        setHrSelectedCredentialId(s.credentials[0].id);
                      }
                    }}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      apaarInput === s.apaarId
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-semibold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {s.name} ({s.district})
                  </button>
                ))}
              </div>
            </div>

            {/* Employer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="employer-select" className="text-slate-300 font-semibold block">
                  Employer Entity
                </label>
                <select
                  id="employer-select"
                  value={employerName}
                  onChange={e => setEmployerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Tata Consultancy Services">Tata Consultancy Services (TCS)</option>
                  <option value="Zoho Corporation">Zoho Corporation</option>
                  <option value="Infosys Limited">Infosys Limited</option>
                  <option value="Cognizant Technology Solutions">Cognizant Technology Solutions</option>
                  <option value="Google India Pvt Ltd">Google India Pvt Ltd</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="verifier-name-input" className="text-slate-300 font-semibold block">
                  HR Verifier Name
                </label>
                <input
                  id="verifier-name-input"
                  type="text"
                  value={verifierName}
                  onChange={e => setVerifierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="verifier-email-input" className="text-slate-300 font-semibold block">
                Official Verifier Work Email
              </label>
              <input
                id="verifier-email-input"
                type="email"
                value={verifierEmail}
                onChange={e => setVerifierEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Credentials to check */}
            <div className="space-y-2">
              <label className="text-slate-300 font-semibold block">
                Credentials to Verify (AICTE & APAAR Secure Vault)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'DEGREE', label: 'Degree Certificate' },
                  { key: 'MARKSHEET', label: 'Consolidated Marksheet' },
                  { key: 'AICTE_APPROVAL', label: 'AICTE Approval Check' },
                  { key: 'ABC_TRANSCRIPT', label: 'ABC Credit Transcript' },
                ].map(cred => (
                  <label
                    key={cred.key}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedCredTypes.includes(cred.key as any)
                        ? 'bg-amber-950/40 border-amber-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCredTypes.includes(cred.key as any)}
                      onChange={() => handleToggleCredType(cred.key as any)}
                      className="accent-amber-500 rounded"
                    />
                    <span className="text-[11px] font-medium">{cred.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="purpose-input" className="text-slate-300 font-semibold block">
                Verification Purpose (DPDP Compliance requirement)
              </label>
              <textarea
                id="purpose-input"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow-md text-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send Background Verification Request</span>
            </button>
          </form>

          {/* Quick Request Selector */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-slate-400 text-xs font-semibold block">
              Active Employer Verification Records:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {requests.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRequestId(r.id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                    selectedRequestId === r.id
                      ? 'bg-amber-950/40 border-amber-500/80 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-semibold block truncate">
                      {r.studentName} ({r.studentApaarId})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {r.employerName} · #{r.id}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                      r.status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : r.status === 'PENDING_STUDENT_CONSENT'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : r.status === 'CONSENT_REVOKED' || r.status === 'TAMPERED_FAILED'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {r.status === 'PENDING_STUDENT_CONSENT' ? 'PENDING CONSENT' : r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column (7 cols): Steps 2, 3, and 4 Workflow Viewer */}
        <div className="lg:col-span-7 space-y-6">
          {activeRequest ? (
            <div className="bg-[#111927] border border-slate-800 rounded-xl p-6 shadow-md space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                      Request ID: {activeRequest.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      Logged at{' '}
                      {new Date(activeRequest.requestedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {activeRequest.studentName} — APAAR: {activeRequest.studentApaarId}
                  </h3>
                </div>

                {/* Status indicator */}
                <div>
                  {activeRequest.status === 'PENDING_STUDENT_CONSENT' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/80 text-amber-400 text-xs font-semibold">
                      <Clock className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Step 2: Awaiting Student Consent</span>
                    </div>
                  )}
                  {activeRequest.status === 'CONSENT_GRANTED' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/60 border border-sky-500/80 text-sky-400 text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-sky-400" />
                      <span>Consent Granted · Ready for HR Verification</span>
                    </div>
                  )}
                  {activeRequest.status === 'VERIFYING' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/80 text-indigo-400 text-xs font-semibold">
                      <Cpu className="w-4 h-4 animate-pulse text-indigo-400" />
                      <span>Step 3: Running HR OCR & APAAR Vault PKI...</span>
                    </div>
                  )}
                  {activeRequest.status === 'VERIFIED' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/80 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Step 4: HR & Vault OCR Verified</span>
                    </div>
                  )}
                  {activeRequest.status === 'CONSENT_REVOKED' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/80 text-rose-400 text-xs font-bold">
                      <Ban className="w-4 h-4 text-rose-400" />
                      <span>Access Revoked by Student (DPDP Act)</span>
                    </div>
                  )}
                  {activeRequest.status === 'TAMPERED_FAILED' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/80 text-rose-400 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>HR Flagged / Tamper Detected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 Section: Student Consent Notification status */}
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Step 2: DPDP Student Consent Handshake
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Candidate: {activeRequest.studentName}
                  </span>
                </div>

                {activeRequest.status === 'PENDING_STUDENT_CONSENT' ? (
                  <div className="space-y-3">
                    <p className="text-slate-300 text-xs leading-relaxed">
                      An encrypted consent notification has been dispatched to candidate's registered mobile device and APAAR Student Consent Portal. HR can either await student consent or execute direct HR OCR & Vault verification below.
                    </p>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleRunHrActiveVerification({
                            requestId: activeRequest.id,
                            student: targetStudent || undefined,
                            hrDecision: 'APPROVE',
                          })
                        }
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm cursor-pointer"
                      >
                        <ScanText className="w-3.5 h-3.5" />
                        <span>HR Direct OCR & Vault Verify Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSimulateConsentApproval(activeRequest.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simulate Candidate Approving in App</span>
                      </button>

                      <button
                        type="button"
                        onClick={onSwitchToStudentView}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Student Dashboard to Review</span>
                      </button>
                    </div>
                  </div>
                ) : activeRequest.status === 'CONSENT_REVOKED' ? (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5" />
                      <span>Consent Revoked by Student</span>
                    </div>
                    <p className="text-[11px] text-rose-400">
                      Reason: "{activeRequest.revocationReason || 'Candidate withdrew consent under Section 6 of DPDP Act 2023'}". Employer access token has been purged.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Consent approved on{' '}
                      {activeRequest.consentGrantedAt
                        ? new Date(activeRequest.consentGrantedAt).toLocaleString()
                        : 'Recent timestamp'}
                      .
                    </span>
                  </div>
                )}
              </div>

              {/* Step 3 Section: HR Active OCR & Backend APAAR Vault PKI Validation */}
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    Step 3: HR Active OCR & APAAR Vault Cryptographic Verification
                  </span>
                  {activeRequest.backendValidation && (
                    <span className="font-mono text-[10px] text-slate-400">
                      Latency: {activeRequest.backendValidation.networkLatencyMs}ms
                    </span>
                  )}
                </div>

                <p className="text-slate-300 text-xs">
                  HR verifiers can actively run or re-run 7-field OCR extraction and HMAC-SHA256 signature verification against the connected APAAR Vault Database at any time.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onExecuteBackendValidation(activeRequest.id, false);
                      handleRunHrActiveVerification({
                        requestId: activeRequest.id,
                        student: targetStudent || undefined,
                        hrDecision: 'APPROVE',
                        simulateTamper: false,
                      });
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {activeRequest.status === 'VERIFIED'
                        ? 'Re-Run HR OCR & Vault Signature Verification'
                        : 'Run HR OCR & Digital Signature Verification'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => hrFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File to Verify via OCR</span>
                  </button>

                  {/* Tamper simulation tester */}
                  <button
                    type="button"
                    onClick={() => {
                      onExecuteBackendValidation(activeRequest.id, true);
                      handleRunHrActiveVerification({
                        requestId: activeRequest.id,
                        student: targetStudent || undefined,
                        hrDecision: 'REJECT',
                        simulateTamper: true,
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/80 hover:bg-rose-900 border border-rose-800 rounded-lg transition-colors cursor-pointer"
                    title="Simulate candidate presenting an edited/tampered certificate to test HR OCR & PKI mismatch alert"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Test Fake/Tampered Record Detection</span>
                  </button>
                </div>

                {activeRequest.backendValidation && (
                  <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 pb-1 border-b border-slate-800">
                      <span>Repository: {activeRequest.backendValidation.repositoryChecked}</span>
                      <span>Algorithm: {activeRequest.backendValidation.signatureAlgorithm}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div className="text-slate-300">
                        <span className="text-slate-500 block text-[10px]">Root Certifying Authority (CA):</span>
                        <span>{activeRequest.backendValidation.issuerCA}</span>
                      </div>

                      <div className="text-slate-300">
                        <span className="text-slate-500 block text-[10px]">HR Verifier Sign-Off:</span>
                        <span className="text-emerald-400 font-bold">
                          {activeRequest.backendValidation.hrVerifiedBy || verifierName} (
                          {activeRequest.backendValidation.hrOrganization || employerName})
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="text-slate-300">
                        <span className="text-slate-500 block text-[10px]">X.509 Serial:</span>
                        <span className="text-amber-400">{activeRequest.backendValidation.certificateSerial}</span>
                      </div>

                      <div className="text-slate-300">
                        <span className="text-slate-500 block text-[10px]">OCR Field Match Score:</span>
                        <span className="text-amber-300 font-bold">
                          {activeRequest.backendValidation.ocrMatchedFields || '7/7'} Fields Matched (
                          {activeRequest.backendValidation.ocrConfidencePercent || 99.6}% Confidence)
                        </span>
                      </div>
                    </div>

                    <div className="truncate text-slate-300">
                      <span className="text-slate-500 block text-[10px]">SHA-256 Digest Fingerprint:</span>
                      <span className="text-emerald-400">{activeRequest.backendValidation.sha256Digest}</span>
                    </div>

                    {activeRequest.backendValidation.hrRemarks && (
                      <div className="text-slate-300 pt-1 border-t border-slate-900">
                        <span className="text-slate-500 block text-[10px]">HR Verification Note:</span>
                        <span className="text-slate-200 font-sans">
                          {activeRequest.backendValidation.hrRemarks}
                        </span>
                      </div>
                    )}

                    {activeRequest.backendValidation.isTampered && (
                      <div className="p-2 bg-rose-950 border border-rose-800 text-rose-400 text-xs rounded mt-2">
                        {activeRequest.backendValidation.tamperDetails}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4 Section: Result Dossier & Per-Credential HR OCR Verification */}
              {targetStudent && targetStudent.credentials.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-400" />
                      Step 4: Candidate Credentials & Direct HR OCR Verification ({targetStudent.credentials.length})
                    </h4>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleRunHrActiveVerification({
                            requestId: activeRequest.id,
                            student: targetStudent,
                            credential: targetStudent.credentials[0],
                            hrDecision: 'APPROVE',
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>HR Verify All via OCR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewAuditTrail(activeRequest.id)}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>View Audit Trail</span>
                      </button>
                    </div>
                  </div>

                  {/* All Candidate Credentials with Individual HR Verify via OCR Buttons */}
                  <div className="space-y-3">
                    {targetStudent.credentials.map(cred => {
                      const vaultUri = ensureVaultUri(
                        cred.digilockerUri,
                        targetStudent.apaarId,
                        cred.id,
                        cred.type
                      );
                      return (
                        <div
                          key={cred.id}
                          className="bg-gradient-to-b from-[#142033] to-[#0f1725] border border-emerald-500/40 rounded-xl p-5 relative overflow-hidden shadow-lg"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded tracking-wide uppercase">
                                  {cred.type.replace('_', ' ')} · VAULT SEALED
                                </span>
                                {cred.documentFileName && (
                                  <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                                    File: {cred.documentFileName}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-white mt-1.5">{cred.title}</h3>
                              <p className="text-xs text-slate-300">{cred.issuingInstitution}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setHrSelectedStudentApaar(targetStudent.apaarId);
                                  setHrSelectedCredentialId(cred.id);
                                  handleRunHrActiveVerification({
                                    requestId: activeRequest.id,
                                    student: targetStudent,
                                    credential: cred,
                                    hrDecision: 'APPROVE',
                                  });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                              >
                                <ScanText className="w-3.5 h-3.5" />
                                <span>HR Verify via OCR</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onViewCertificateDetails(cred)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Open & Inspect</span>
                              </button>
                            </div>
                          </div>

                          {/* Metadata grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-700/60 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Student Name:</span>
                              <strong className="text-white">{targetStudent.name}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">APAAR ID:</span>
                              <span className="font-mono text-amber-400 font-bold">
                                {targetStudent.apaarId}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">CGPA / Grade:</span>
                              <strong className="text-emerald-400">{cred.cgpaOrPercentage}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Year of Passing:</span>
                              <strong className="text-white">{cred.yearOfPassing}</strong>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-mono">
                            <span className="truncate max-w-md">Vault URI: {vaultUri}</span>
                            <span>AICTE: {cred.aicteApprovalNumber}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#111927] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              Select or submit a verification request to view the live workflow.
            </div>
          )}
        </div>
      </div>

      {/* Physical APAAR Card QR Scanner Modal */}
      <ApaarQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        students={students}
        defaultEmployerName={employerName}
        defaultVerifierName={verifierName}
        defaultVerifierEmail={verifierEmail}
        defaultRequestedCredentials={selectedCredTypes}
        defaultPurpose={purpose}
        onSubmitRequest={onSubmitRequest}
        onScanSuccess={({ student, requestId }) => {
          handleApaarChange(student.apaarId);
          setHrSelectedStudentApaar(student.apaarId);
          if (student.credentials.length > 0) {
            setHrSelectedCredentialId(student.credentials[0].id);
          }
          if (requestId) {
            setSelectedRequestId(requestId);
          }
          setQrScanSuccessToast({
            studentName: student.name,
            apaarId: student.apaarId,
            requestId,
          });
          setTimeout(() => {
            setQrScanSuccessToast(null);
          }, 8000);
        }}
      />
    </div>
  );
};
