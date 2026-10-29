/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AcademicCredential, Student } from '../types';
import {
  ensureVaultUri,
  buildVaultReceipt,
  formatVaultFileSize,
  verifyDocumentViaOcr,
  VaultOcrVerificationReport,
  VAULT_ROOT_AUTHORITY,
} from '../utils/vaultEngine';
import { realtimeClient } from '../services/realtimeClient';
import {
  X,
  ShieldCheck,
  QrCode,
  Lock,
  Printer,
  Award,
  Download,
  FileText,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  LogOut,
  ScanText,
} from 'lucide-react';

interface CertificateModalProps {
  credential: AcademicCredential | null;
  student?: Student | null;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  credential,
  student,
  onClose,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    computedDigest: string;
    storedDigest: string;
    signatureAlgorithm: string;
    issuerSerial: string;
    vaultAuthority: string;
    verifiedAt: string;
    reason?: string;
    ocrReport?: VaultOcrVerificationReport;
  } | null>(null);
  const [showInlineFilePreview, setShowInlineFilePreview] = useState(false);
  const [showRawOcrText, setShowRawOcrText] = useState(false);

  useEffect(() => {
    setVerificationResult(null);
    setShowInlineFilePreview(false);
    setShowRawOcrText(false);
  }, [credential?.id]);

  useEffect(() => {
    if (!credential) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [credential, onClose]);

  if (!credential) return null;

  const studentApaar = student?.apaarId || '2990 9583 2586';
  const studentName = student?.name || 'Abinaya S';
  const vaultUri = ensureVaultUri(credential.digilockerUri, studentApaar, credential.id, credential.type);

  const handleVerifyDocumentNow = async () => {
    setIsVerifying(true);
    const localOcr = verifyDocumentViaOcr({
      credential,
      studentName,
      studentApaarId: studentApaar,
    });
    try {
      const res = await realtimeClient.ocrVerifyVaultDocument({
        credentialId: credential.id,
        studentApaarId: studentApaar,
        fileName: credential.documentFileName,
        dataUrl: credential.documentDataUrl,
      });
      if (res.ok && res.data?.ocrReport) {
        const report = res.data.ocrReport;
        setVerificationResult({
          verified: res.data.verified,
          computedDigest: report.computedSha256,
          storedDigest: report.storedSha256,
          signatureAlgorithm: 'OCR + HMAC-SHA256',
          issuerSerial: credential.issuerCertificateSerial || 'APAAR-SERVER-HMAC-SHA256',
          vaultAuthority: VAULT_ROOT_AUTHORITY,
          verifiedAt: report.verifiedAt,
          ocrReport: report,
        });
      } else {
        setVerificationResult({
          verified: localOcr.verified,
          computedDigest: localOcr.computedSha256,
          storedDigest: localOcr.storedSha256,
          signatureAlgorithm: 'OCR + HMAC-SHA256',
          issuerSerial: credential.issuerCertificateSerial || 'APAAR-SERVER-HMAC-SHA256',
          vaultAuthority: VAULT_ROOT_AUTHORITY,
          verifiedAt: localOcr.verifiedAt,
          ocrReport: localOcr,
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadReceipt = () => {
    const receipt = buildVaultReceipt(credential, studentName, studentApaar);
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apaar-vault-receipt-${credential.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Certificate and Document Inspector - ${credential.title}`}
        className="bg-[#111927] border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Sticky Header bar with prominent Exit / Close button */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-white text-xs sm:text-sm truncate">
              APAAR Secure Credential Vault · OCR Document &amp; Certificate Inspector
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleVerifyDocumentNow}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <ScanText className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'OCR Scanning…' : 'Verify Document via OCR'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Exit and close document view"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Exit / Close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Certificate & Document Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Live OCR Document Verification Result Banner */}
          {verificationResult && (
            <div
              className={`p-4 rounded-xl border-2 space-y-3 text-xs font-mono ${
                verificationResult.verified
                  ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/80 text-rose-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>
                    {verificationResult.verified
                      ? 'OCR DOCUMENT VERIFIED AUTHENTIC · APAAR VAULT DATABASE MATCH'
                      : 'OCR DOCUMENT VERIFICATION FAILED · FIELD MISMATCH DETECTED'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {verificationResult.ocrReport && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                      OCR {verificationResult.ocrReport.matchedFieldsCount}/{verificationResult.ocrReport.totalFieldsCount} FIELDS ({verificationResult.ocrReport.ocrConfidencePercent}%)
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold">
                    {verificationResult.signatureAlgorithm} VALID
                  </span>
                </div>
              </div>

              {verificationResult.ocrReport && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Engine: <strong className="text-amber-400">{verificationResult.ocrReport.ocrEngine}</strong></span>
                    <button
                      type="button"
                      onClick={() => setShowRawOcrText(prev => !prev)}
                      className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 font-bold text-[10px] cursor-pointer"
                    >
                      {showRawOcrText ? 'Hide OCR Text Transcript' : 'Show OCR Text Transcript'}
                    </button>
                  </div>

                  {/* OCR Field-by-Field Comparison Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-1.5 px-2.5">OCR Scanned Field</th>
                          <th className="py-1.5 px-2.5">OCR Extracted from Document</th>
                          <th className="py-1.5 px-2.5">APAAR Vault DB Record</th>
                          <th className="py-1.5 px-2.5 text-right">OCR Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {verificationResult.ocrReport.fieldComparisons.map(field => (
                          <tr key={field.fieldKey}>
                            <td className="py-1.5 px-2.5 font-bold text-slate-200">{field.fieldLabel}</td>
                            <td className="py-1.5 px-2.5 text-amber-300 truncate max-w-[180px]">{field.ocrExtractedValue}</td>
                            <td className="py-1.5 px-2.5 text-emerald-300 truncate max-w-[180px]">{field.vaultDbValue}</td>
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

                  {showRawOcrText && (
                    <pre className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-300 whitespace-pre-wrap overflow-x-auto">
                      {verificationResult.ocrReport.extractedRawText}
                    </pre>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300">
                <div className="truncate">
                  <span className="text-slate-400">Computed SHA-256: </span>
                  <span className="text-emerald-400 font-bold">{verificationResult.computedDigest.slice(0, 28)}...</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">Vault DB SHA-256: </span>
                  <span className="text-emerald-400 font-bold">{verificationResult.storedDigest.slice(0, 28)}...</span>
                </div>
              </div>
            </div>
          )}

          {/* Uploaded Document File Bar + In-App Preview with Exit option */}
          {credential.documentFileName && (
            <div className="bg-slate-900/90 rounded-xl p-4 border border-emerald-500/50 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-mono">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-white font-bold block">
                      Uploaded Vault File: {credential.documentFileName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Size: {formatVaultFileSize(credential.documentSizeBytes)} · MIME: {credential.documentMimeType || 'application/pdf'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {credential.documentDataUrl && (
                    <button
                      type="button"
                      onClick={() => setShowInlineFilePreview(prev => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                    >
                      {showInlineFilePreview ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Close File Preview (Exit File)</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Open File Preview</span>
                        </>
                      )}
                    </button>
                  )}
                  {credential.documentDataUrl && (
                    <a
                      href={credential.documentDataUrl}
                      download={credential.documentFileName || `${credential.id}.pdf`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-semibold text-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              </div>

              {credential.documentFileSha256 && (
                <div className="text-[11px] font-mono text-slate-400 break-all bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span className="text-slate-500">File SHA-256 Checksum: </span>
                  <span className="text-amber-400 font-semibold">{credential.documentFileSha256}</span>
                </div>
              )}

              {showInlineFilePreview && credential.documentDataUrl && (
                <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950 space-y-2 p-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Viewing File: {credential.documentFileName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInlineFilePreview(false)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Exit File Preview</span>
                    </button>
                  </div>

                  {credential.documentMimeType?.startsWith('image/') ? (
                    <img
                      src={credential.documentDataUrl}
                      alt={credential.documentFileName}
                      className="max-h-72 mx-auto rounded-lg object-contain"
                    />
                  ) : (
                    <iframe
                      src={credential.documentDataUrl}
                      title={credential.documentFileName}
                      className="w-full h-64 rounded bg-white"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Certificate Container */}
          <div className="bg-[#111927] border-2 border-amber-500/50 rounded-xl p-6 sm:p-8 relative overflow-hidden text-center space-y-5 shadow-inner">
            {/* Top Emblems */}
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
              <div className="text-left">
                <span className="text-[10px] tracking-widest uppercase font-bold text-amber-400 block">
                  APAAR NATIONAL REGISTRY
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  Self-Contained Cryptographic Vault
                </span>
              </div>

              <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
                <Award className="w-5 h-5" />
              </div>

              <div className="text-right">
                <span className="text-[10px] tracking-widest uppercase font-bold text-emerald-400 block">
                  APAAR VAULT SEALED
                </span>
                <span className="text-xs font-mono text-slate-400">
                  HMAC-SHA256 PKI
                </span>
              </div>
            </div>

            {/* Main Text */}
            <div className="space-y-3 py-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
                {credential.title}
              </h2>
              <p className="text-xs text-slate-300 max-w-lg mx-auto">
                This is to certify that the academic record registered under APAAR ID{' '}
                <strong className="text-amber-400 font-mono">{studentApaar}</strong> belonging to{' '}
                <strong className="text-white">{studentName}</strong> has been awarded and sealed into the APAAR Secure Vault by
              </p>
              <h3 className="text-sm sm:text-base font-bold text-amber-300">
                {credential.issuingInstitution}
              </h3>

              <div className="max-w-lg mx-auto mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 border border-amber-500/40 rounded-xl p-3 text-left">
                <div className="border-b sm:border-b-0 sm:border-r border-slate-800 pb-2 sm:pb-0 sm:pr-3">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 block">
                    APAAR ID (12-Digit National ID)
                  </span>
                  <span className="text-sm font-mono font-extrabold text-white tracking-wider">
                    {studentApaar}
                  </span>
                </div>
                <div className="sm:pl-1">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block">
                    Student ID / University Roll (PEN)
                  </span>
                  <span className="text-sm font-mono font-extrabold text-white tracking-wider">
                    {student?.pen || 'PEN-20238910421'}
                  </span>
                </div>
              </div>
            </div>

            {/* Details Box */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-xs text-left">
              <div>
                <span className="text-slate-500 block text-[10px]">Grade / Performance:</span>
                <strong className="text-emerald-400">{credential.cgpaOrPercentage}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Year of Conferment:</span>
                <strong className="text-white">{credential.yearOfPassing}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">AICTE Approval Code:</span>
                <strong className="text-amber-400 font-mono">{credential.aicteApprovalNumber}</strong>
              </div>
            </div>

            {/* Bottom Signature Seals */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-amber-500/20 text-left text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 block">APAAR Secure Vault URI:</span>
                <code className="text-emerald-400 text-[11px] font-mono break-all">
                  {vaultUri}
                </code>
              </div>

              <div className="w-14 h-14 bg-white p-1 rounded-lg shrink-0 flex items-center justify-center shadow">
                <QrCode className="w-12 h-12 text-slate-950" />
              </div>
            </div>
          </div>

          {/* Cryptographic PKI Breakdown */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Lock className="w-4 h-4" />
              <span>APAAR Secure Vault Cryptographic Seal Details</span>
            </div>

            <div className="text-slate-400 space-y-1 pt-1 text-[11px]">
              <div>
                <span className="text-slate-500">Algorithm: </span>
                <span className="text-slate-200">HMAC-SHA256 (Server Vault Signing Key)</span>
              </div>
              <div>
                <span className="text-slate-500">Vault Authority: </span>
                <span className="text-slate-200">{VAULT_ROOT_AUTHORITY}</span>
              </div>
              <div>
                <span className="text-slate-500">Certificate Serial: </span>
                <span className="text-amber-400">{credential.issuerCertificateSerial}</span>
              </div>
              <div className="break-all">
                <span className="text-slate-500">SHA-256 Digest: </span>
                <span className="text-emerald-400">{credential.sha256Hash}</span>
              </div>
              <div className="break-all">
                <span className="text-slate-500">Digital Signature: </span>
                <span className="text-slate-400">{credential.digitalSignature}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer actions with explicit Exit / Close button */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit / Close Window</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyDocumentNow}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isVerifying ? 'Verifying…' : 'Verify Document'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Receipt (JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
