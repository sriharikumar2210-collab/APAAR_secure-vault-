/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  X,
  BookOpen,
  ShieldCheck,
  QrCode,
  GraduationCap,
  KeyRound,
  FileCheck2,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface ApaarGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateAccount: () => void;
  onOpenStudentRegistration: () => void;
}

export const ApaarGuideModal: React.FC<ApaarGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateAccount,
  onOpenStudentRegistration,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#101826] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c121d]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="guide-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
              >
                <span>APAAR Portal User Guide & Quick Help</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Easy to Understand
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Elithana Valikaatti · How background verification & student consent works
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close guide modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Quick Summary Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              What is APAAR? (APAAR Endral Enna?)
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>APAAR</strong> stands for <em>Automated Permanent Academic Account Registry</em> — a unique 12-digit lifelong digital identity for every student in India under the National Education Policy (NEP 2020). It connects school, college, degrees, transcripts, and certificates into a tamper-proof digital locker.
            </p>
          </div>

          {/* 4-Step Process Cards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              How The System Works (4 Elithana Padigal / 4 Simple Steps):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Student Gets 12-Digit APAAR
                  </h5>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Students register with Aadhaar & UDISE PEN. Degrees & marksheets are cryptographically sealed in the APAAR Secure Vault with AICTE signatures.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Employer Requests Verification
                  </h5>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  HR types the student's 12-digit APAAR ID or scans the physical card QR code to trigger a real-time verification request.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Candidate Grants Consent (DPDP)
                  </h5>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Under DPDP Act 2023, the student receives an instant SMS/Email notification. They choose exactly what certificates to share (or reject).
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Zero Fake Credentials Verified
                  </h5>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cryptographic SHA-256 digests and RSA signatures verify issuer authenticity in milliseconds. Tampered certificates are flagged instantly!
                </p>
              </div>
            </div>
          </div>

          {/* Quick Glossary / Terminology */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Bilingual Terminology Guide (Mukkiya Sorkal):
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Term</th>
                    <th className="py-2.5 px-3">Meaning in Tanglish</th>
                    <th className="py-2.5 px-3">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">APAAR ID</td>
                    <td className="py-2 px-3">12-Digit Lifelong Student Academic Identity Number</td>
                    <td className="py-2 px-3">Unique nationwide academic ID</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">BGV (Background Verification)</td>
                    <td className="py-2 px-3">Company Velai Saandridhal Sariparthal (Verification)</td>
                    <td className="py-2 px-3">Employer verification of genuine degree</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">Student Consent</td>
                    <td className="py-2 px-3">Maanavarin Thanippatta Data Pagirvu Opputhal</td>
                    <td className="py-2 px-3">Privacy protection under DPDP Act 2023</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">APAAR Secure Vault</td>
                    <td className="py-2 px-3">Self-Contained Cryptographic Saandridhal Bettagam</td>
                    <td className="py-2 px-3">Central verified digital credential vault</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Ready to explore or test?
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Create a custom account or register a new student with APAAR ID.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateAccount();
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs"
              >
                + Create New Account
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStudentRegistration();
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-xs"
              >
                + Register Student
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c121d]/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Got it, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
