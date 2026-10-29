/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  VerificationRequest,
  Student,
  AcademicCredential,
} from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  Clock,
  FileText,
  Lock,
  UserCheck,
  QrCode,
  Smartphone,
  AlertTriangle,
  ChevronRight,
  Info,
  X,
  Sparkles,
} from 'lucide-react';

export type ApprovalMode = 'REQUEST_APPROVAL' | 'APAAR_ENROLLMENT_APPROVAL';

export type ApprovalMethod = 'AADHAAR_OTP' | 'EXPRESS_ONE_CLICK' | 'TIME_BOUND' | 'SCOPE_RESTRICTED';

interface ApaarApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ApprovalMode;
  
  // For REQUEST_APPROVAL
  request?: VerificationRequest;
  onApproveRequest?: (
    requestId: string,
    options: {
      method: ApprovalMethod;
      scope: VerificationRequest['scopeOfAccess'];
      validityHours: number;
      aadhaarOtpVerified: boolean;
      autoApproveFuture: boolean;
    }
  ) => void;
  onRejectRequest?: (requestId: string, reason: string) => void;

  // For APAAR_ENROLLMENT_APPROVAL
  student?: Student;
  onApproveEnrollment?: (
    studentApaarId: string,
    details: {
      consentType: 'PARENTAL' | 'STUDENT_SELF';
      guardianName?: string;
      aadhaarVerified: boolean;
      otpUsed: string;
    }
  ) => void;
}

export const ApaarApprovalModal: React.FC<ApaarApprovalModalProps> = ({
  isOpen,
  onClose,
  mode,
  request,
  onApproveRequest,
  onRejectRequest,
  student,
  onApproveEnrollment,
}) => {
  if (!isOpen) return null;

  // Tabs / Options State for REQUEST_APPROVAL
  const [selectedMethod, setSelectedMethod] = useState<ApprovalMethod>('AADHAAR_OTP');
  const [validityHours, setValidityHours] = useState<number>(24);
  const [selectedScope, setSelectedScope] = useState<VerificationRequest['scopeOfAccess']>(
    request?.scopeOfAccess || ['IDENTITY', 'ACADEMIC_MARKS', 'DIGITAL_SIGNATURE']
  );
  const [autoApproveFuture, setAutoApproveFuture] = useState(false);

  // OTP State
  const [otpValue, setOtpValue] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(45);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // State for APAAR_ENROLLMENT_APPROVAL
  const isMinor = student ? ['Primary', 'Middle', 'Secondary', 'Higher Secondary'].includes(student.stage) : false;
  const [consentType, setConsentType] = useState<'PARENTAL' | 'STUDENT_SELF'>(isMinor ? 'PARENTAL' : 'STUDENT_SELF');
  const [guardianName, setGuardianName] = useState('Sundaram S (Father / Legal Guardian)');
  const [agreedDeclarations, setAgreedDeclarations] = useState({
    apaarCreation: true,
    abcLinking: true,
    aadhaarDemographic: true,
    dataPrivacyNotice: true,
  });

  // Countdown timer for simulated OTP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  const handleSendOtp = () => {
    setOtpSent(true);
    setOtpTimer(45);
    setOtpError(null);
  };

  const handleScopeToggle = (item: 'IDENTITY' | 'ACADEMIC_MARKS' | 'DIGITAL_SIGNATURE' | 'FULL_TRANSCRIPT') => {
    if (selectedScope.includes(item)) {
      if (selectedScope.length === 1) return; // Keep at least one
      setSelectedScope(prev => prev.filter(s => s !== item));
    } else {
      setSelectedScope(prev => [...prev, item]);
    }
  };

  // Submission for Background Verification Request Approval
  const handleExecuteRequestApproval = () => {
    if (selectedMethod === 'AADHAAR_OTP') {
      if (!otpValue || otpValue.length < 6) {
        setOtpError('Please enter the 6-digit Aadhaar OTP sent to your registered mobile number.');
        return;
      }
      if (otpValue !== '262630' && otpValue !== '123456') {
        setOtpError('Invalid OTP. For demonstration, use default OTP 262630 or 123456.');
        return;
      }
    }

    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (request && onApproveRequest) {
          onApproveRequest(request.id, {
            method: selectedMethod,
            scope: selectedScope,
            validityHours,
            aadhaarOtpVerified: selectedMethod === 'AADHAAR_OTP',
            autoApproveFuture,
          });
        }
        onClose();
      }, 1200);
    }, 800);
  };

  // Submission for APAAR ID Generation & Enrollment Approval
  const handleExecuteEnrollmentApproval = () => {
    if (!agreedDeclarations.apaarCreation || !agreedDeclarations.aadhaarDemographic) {
      setOtpError('Mandatory consent declarations must be acknowledged before approving APAAR enrollment.');
      return;
    }

    if (otpValue && otpValue !== '262630' && otpValue !== '123456') {
      setOtpError('Invalid OTP. Use demo OTP 262630.');
      return;
    }

    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (student && onApproveEnrollment) {
          onApproveEnrollment(student.apaarId, {
            consentType,
            guardianName: consentType === 'PARENTAL' ? guardianName : undefined,
            aadhaarVerified: true,
            otpUsed: otpValue || '262630',
          });
        }
        onClose();
      }, 1200);
    }, 700);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apaar-approval-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#111927] border border-amber-500/40 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#0f1725] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="apaar-approval-title" className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                {mode === 'REQUEST_APPROVAL' ? 'APAAR Consent & Approval Options' : 'APAAR ID Enrollment & Consent Approval'}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  DPDP Act 2023
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'REQUEST_APPROVAL'
                  ? 'Select your authorization method and configure data access controls.'
                  : 'Official Ministry of Education (MoE) & DoSEL APAAR ID consent declaration.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close approval modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">

          {/* SUCCESS OVERLAY */}
          {isSuccess && (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {mode === 'REQUEST_APPROVAL' ? 'Consent Authorization Granted!' : 'APAAR ID Successfully Approved & Activated!'}
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                {mode === 'REQUEST_APPROVAL'
                  ? 'Cryptographic audit trail entry logged. Employer is now granted time-bound, scoped data access.'
                  : 'APAAR ID card generated with verified UIDAI demographic authentication and APAAR Secure Vault link.'}
              </p>
            </div>
          )}

          {!isSuccess && mode === 'REQUEST_APPROVAL' && request && (
            <>
              {/* Context banner for Request */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Requesting Organization:</span>
                  <span className="font-bold text-amber-400 font-mono text-sm">{request.employerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Student:</span>
                  <span className="text-white font-medium">{request.studentName} (<code className="text-amber-300">{request.studentApaarId}</code>)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Stated Purpose:</span>
                  <span className="text-slate-300 italic truncate max-w-xs">{request.purpose}</span>
                </div>
              </div>

              {/* 4 Approval Options Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Select APAAR Approval Option:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Aadhaar OTP e-Sign */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('AADHAAR_OTP')}
                    className={`p-3.5 rounded-xl border text-left transition-all relative ${
                      selectedMethod === 'AADHAAR_OTP'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-400 mb-1">
                      <KeyRound className="w-4 h-4" />
                      <span>Option 1: Aadhaar OTP e-Sign</span>
                      <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded">
                        Most Secure
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Digitally sign consent with 6-digit OTP sent to UIDAI registered mobile number.
                    </p>
                  </button>

                  {/* Option 2: Express 1-Click Approval */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('EXPRESS_ONE_CLICK')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedMethod === 'EXPRESS_ONE_CLICK'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-400 mb-1">
                      <Sparkles className="w-4 h-4" />
                      <span>Option 2: 1-Click Fast Approval</span>
                      <span className="ml-auto text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">
                        Instant
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Immediate authorization based on pre-verified student portal session.
                    </p>
                  </button>

                  {/* Option 3: Time-Bound Approval */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('TIME_BOUND')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedMethod === 'TIME_BOUND'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-400 mb-1">
                      <Clock className="w-4 h-4" />
                      <span>Option 3: Time-Limited Access</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Grant temporary access that automatically self-destructs after a set window.
                    </p>
                  </button>

                  {/* Option 4: Custom Scoped Access */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('SCOPE_RESTRICTED')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedMethod === 'SCOPE_RESTRICTED'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-400 mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Option 4: Granular Data Scope</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Pick exactly which credentials and fields employer is permitted to inspect.
                    </p>
                  </button>
                </div>
              </div>

              {/* Dynamic Option Detail Panels */}
              {selectedMethod === 'AADHAAR_OTP' && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      Aadhaar Registered Mobile Verification
                    </span>
                    <span className="text-[11px] text-slate-400">UIDAI Demo Gateway</span>
                  </div>

                  {!otpSent ? (
                    <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="text-xs">
                        <span className="text-slate-400 block">OTP will be dispatched to:</span>
                        <strong className="text-slate-200 font-mono">+91 ******4821 (Linked Aadhaar)</strong>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-colors"
                      >
                        Send OTP
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          id="aadhaar-otp-input"
                          type="text"
                          maxLength={6}
                          value={otpValue}
                          onChange={e => {
                            setOtpValue(e.target.value.replace(/\D/g, ''));
                            setOtpError(null);
                          }}
                          placeholder="Enter 6-digit OTP"
                          className="w-48 bg-slate-950 border border-amber-500/70 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest text-amber-300 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => setOtpValue('262630')}
                          className="px-2.5 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
                        >
                          Auto-fill Demo OTP (262630)
                        </button>
                        <span className="text-xs text-slate-500 font-mono ml-auto">
                          Resend in {otpTimer}s
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        An authenticated digital signature token (<code className="text-slate-300">SIG-UIDAI-X509</code>) will be attached to this consent grant.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Time limits selector (Used in Option 3 or default) */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Consent Validity Duration:</span>
                  <span className="text-amber-400 font-mono text-[11px]">
                    {validityHours === 1 ? 'Single verification check only' : `${validityHours} Hours`}
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { label: 'One-Time', val: 1 },
                    { label: '24 Hours', val: 24 },
                    { label: '7 Days', val: 168 },
                    { label: '30 Days', val: 720 },
                  ].map(dur => (
                    <button
                      key={dur.val}
                      type="button"
                      onClick={() => setValidityHours(dur.val)}
                      className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                        validityHours === dur.val
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Scope Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Authorized Information Fields:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'IDENTITY', label: 'Verify Identity & Photo' },
                    { key: 'ACADEMIC_MARKS', label: 'Degree, Class & CGPA' },
                    { key: 'DIGITAL_SIGNATURE', label: 'AICTE / University Signature' },
                    { key: 'FULL_TRANSCRIPT', label: 'Full ABC Credit Ledger' },
                  ].map(item => {
                    const isChecked = selectedScope.includes(item.key as any);
                    return (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-amber-950/30 border-amber-500/50 text-white'
                            : 'bg-slate-900/40 border-slate-800 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleScopeToggle(item.key as any)}
                          className="accent-amber-500 rounded"
                        />
                        <span className="text-[11px] font-medium">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Auto-approve rule option */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={autoApproveFuture}
                  onChange={e => setAutoApproveFuture(e.target.checked)}
                  className="accent-amber-500 rounded mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-200">
                    Auto-approve future verification checks from vetted Fortune 500 & NATS employers
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Saves this employer to your vetted list to eliminate manual approval steps next time.
                  </p>
                </div>
              </label>

              {otpError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}
            </>
          )}

          {/* MODE 2: APAAR_ENROLLMENT_APPROVAL (Student APAAR Registration Consent) */}
          {!isSuccess && mode === 'APAAR_ENROLLMENT_APPROVAL' && student && (
            <>
              {/* Student info summary */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Student Name:</span>
                  <span className="font-bold text-white text-sm">{student.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Allocated APAAR ID:</span>
                  <span className="font-mono text-amber-400 font-bold">{student.apaarId}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Education Stage:</span>
                  <span className="text-slate-300">{student.stage} · {student.currentInstitution}</span>
                </div>
              </div>

              {/* Consent Type Option */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Approval Mandate Type (as per DoSEL / MoE Guidelines):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConsentType('PARENTAL')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      consentType === 'PARENTAL'
                        ? 'bg-amber-950/40 border-amber-500 text-white'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold text-amber-400 block mb-1">
                      Parental / Guardian Consent
                    </span>
                    <span className="text-[11px] text-slate-300">
                      Required for school students under 18 years of age.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsentType('STUDENT_SELF')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      consentType === 'STUDENT_SELF'
                        ? 'bg-amber-950/40 border-amber-500 text-white'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold text-amber-400 block mb-1">
                      Student Self-Consent
                    </span>
                    <span className="text-[11px] text-slate-300">
                      For adult learners enrolled in higher education / UG / PG.
                    </span>
                  </button>
                </div>
              </div>

              {consentType === 'PARENTAL' && (
                <div className="space-y-1">
                  <label htmlFor="guardian-input" className="text-xs text-slate-300 font-semibold block">
                    Parent / Legal Guardian Name:
                  </label>
                  <input
                    id="guardian-input"
                    type="text"
                    value={guardianName}
                    onChange={e => setGuardianName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Mandatory Consent Declarations */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span className="font-semibold text-slate-200 block mb-1">
                  Statutory Consent Declarations (Form 1):
                </span>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedDeclarations.apaarCreation}
                    onChange={e =>
                      setAgreedDeclarations(prev => ({ ...prev, apaarCreation: e.target.checked }))
                    }
                    className="accent-amber-500 rounded mt-0.5"
                  />
                  <span className="text-[11px] text-slate-300">
                    I give voluntary consent to generate APAAR ID and link it to the Permanent Education Number (PEN).
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedDeclarations.abcLinking}
                    onChange={e =>
                      setAgreedDeclarations(prev => ({ ...prev, abcLinking: e.target.checked }))
                    }
                    className="accent-amber-500 rounded mt-0.5"
                  />
                  <span className="text-[11px] text-slate-300">
                    I authorize syncing with APAAR Secure Credential Vault and Academic Bank of Credits (ABC) repository.
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedDeclarations.aadhaarDemographic}
                    onChange={e =>
                      setAgreedDeclarations(prev => ({ ...prev, aadhaarDemographic: e.target.checked }))
                    }
                    className="accent-amber-500 rounded mt-0.5"
                  />
                  <span className="text-[11px] text-slate-300">
                    I acknowledge that Aadhaar demographic data will be used purely for one-time identity verification.
                  </span>
                </label>
              </div>

              {/* Fast OTP or Authentication */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block">UIDAI Aadhaar Authentication:</span>
                  <span className="text-emerald-400 font-mono font-medium">OTP Verified via UIDAI Sandbox (262630)</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-800">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Ready for Approval</span>
                </div>
              </div>

              {otpError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Controls */}
        {!isSuccess && (
          <div className="p-5 border-t border-slate-800 bg-[#0f1725] rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
            {mode === 'REQUEST_APPROVAL' && request && onRejectRequest ? (
              <button
                type="button"
                onClick={() => {
                  onRejectRequest(request.id, 'Candidate declined authorization via approval modal.');
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors border border-rose-900/60"
              >
                Decline Request
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}

            <div className="flex items-center gap-3 ml-auto">
              {mode === 'REQUEST_APPROVAL' ? (
                <button
                  type="button"
                  onClick={handleExecuteRequestApproval}
                  disabled={isVerifyingOtp}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isVerifyingOtp ? 'Verifying OTP...' : 'Approve & Grant Consent'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteEnrollmentApproval}
                  disabled={isVerifyingOtp}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isVerifyingOtp ? 'Approving APAAR...' : 'Approve & Activate APAAR ID'}</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
