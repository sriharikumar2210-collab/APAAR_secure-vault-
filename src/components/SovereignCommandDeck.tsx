/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Student, VerificationRequest, AcademicCredential } from '../types';
import { UserAccount } from '../types/auth';
import { ActiveTab } from './Navbar';
import {
  RotateCw,
  ShieldCheck,
  Search,
  GraduationCap,
  QrCode,
  Eye,
  ScanText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  Building2,
  Briefcase,
  ShieldAlert,
  FolderLock,
  Plus,
} from 'lucide-react';

interface SovereignCommandDeckProps {
  currentUser: UserAccount;
  currentStudent: Student;
  students: Student[];
  requests: VerificationRequest[];
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectStudent: (apaarId: string) => void;
  onInspectCredential: (credential: AcademicCredential) => void;
  onOpenCreateAccountModal: () => void;
  onOpenGuideModal: () => void;
  onOpenCreateStudentModal: () => void;
  allAccounts?: UserAccount[];
  onSwitchRole?: (user: UserAccount) => void;
}

export const SovereignCommandDeck: React.FC<SovereignCommandDeckProps> = ({
  currentUser,
  currentStudent,
  students,
  requests,
  activeTab,
  onSelectTab,
  onSelectStudent,
  onInspectCredential,
  onOpenCreateStudentModal,
  allAccounts = [],
  onSwitchRole,
}) => {
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isDeckExpanded, setIsDeckExpanded] = useState(true);
  const [quickSearch, setQuickSearch] = useState('');

  const pendingConsentCount = requests.filter(r => r.status === 'PENDING_STUDENT_CONSENT').length;
  const primaryCredential = currentStudent.credentials[0];

  const matchingStudents = quickSearch.trim()
    ? students
        .filter(
          s =>
            s.name.toLowerCase().includes(quickSearch.toLowerCase()) ||
            s.apaarId.replace(/\s+/g, '').includes(quickSearch.replace(/\s+/g, '')) ||
            s.district.toLowerCase().includes(quickSearch.toLowerCase())
        )
        .slice(0, 4)
    : [];

  // Pick 1 representative account per role for the 1-Tap Role Switcher bar
  const roleSwitchAccounts = (['EMPLOYER', 'STUDENT', 'INSTITUTION', 'REGULATOR'] as const)
    .map(role => allAccounts.find(a => a.role === role))
    .filter((a): a is UserAccount => Boolean(a));

  const getRolePillMeta = (role: UserAccount['role']) => {
    switch (role) {
      case 'EMPLOYER':
        return {
          label: 'Company HR',
          icon: <Building2 className="w-3.5 h-3.5" />,
          activeClass: 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs',
        };
      case 'STUDENT':
        return {
          label: 'Student',
          icon: <GraduationCap className="w-3.5 h-3.5" />,
          activeClass: 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xs',
        };
      case 'INSTITUTION':
        return {
          label: 'College',
          icon: <Briefcase className="w-3.5 h-3.5" />,
          activeClass: 'bg-sky-500 text-slate-950 border-sky-400 shadow-xs',
        };
      case 'REGULATOR':
        return {
          label: 'Auditor',
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
          activeClass: 'bg-purple-500 text-white border-purple-400 shadow-xs',
        };
    }
  };

  return (
    <section
      aria-label="APAAR Smart Pass and Quick Actions"
      className="border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#0d1422]/95 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Top Simple Bar: 1-Tap Role Switcher + Quick Student Search + Collapse Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: 1-Tap Role Switcher Dock */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
              Switch Role (1-Click):
            </span>
            {roleSwitchAccounts.map(acc => {
              const meta = getRolePillMeta(acc.role);
              const isCurrent = currentUser.role === acc.role;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onSwitchRole?.(acc)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isCurrent
                      ? meta.activeClass
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Quick Search + Add Student + Collapse Pass */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                placeholder="Search student or 12-digit APAAR ID..."
                aria-label="Search student or 12-digit APAAR ID"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
              {matchingStudents.length > 0 && (
                <div className="absolute right-0 left-0 mt-1.5 bg-white dark:bg-[#0d1422] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {matchingStudents.map(s => (
                    <div
                      key={s.apaarId}
                      className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {s.name}
                        </div>
                        <div className="font-mono text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                          {s.apaarId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStudent(s.apaarId);
                            onSelectTab('employer-bgv');
                            setQuickSearch('');
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          HR Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStudent(s.apaarId);
                            onSelectTab('student-portal');
                            setQuickSearch('');
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Vault
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenCreateStudentModal}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeckExpanded(prev => !prev)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Fingerprint className="w-3.5 h-3.5 text-amber-500" />
              <span>{isDeckExpanded ? 'Minimize Pass' : 'Show Smart Pass'}</span>
              {isDeckExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Main Deck: Interactive APAAR Smart Card + 3 Easy One-Click Action Cards */}
        {isDeckExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left 5 Cols: Interactive Flippable APAAR Smart Identity Pass */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#142033] to-[#0b1322] border-2 border-amber-500/50 p-4 shadow-md relative overflow-hidden apaar-card-engrave">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/70">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                    A
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-wide text-amber-800 dark:text-amber-300">
                      APAAR DIGITAL SMART CARD
                    </div>
                    <div className="text-[10px] text-slate-600 dark:text-slate-300">
                      12-Digit Student ID & Cryptographic Vault Pass
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCardFlipped(prev => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-300 border border-amber-500/50 text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>{isCardFlipped ? 'Show Front' : 'Flip Card'}</span>
                </button>
              </div>

              {!isCardFlipped ? (
                <div className="py-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                        12-Digit APAAR ID
                      </span>
                      <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-amber-600 dark:text-amber-400 tabular-nums">
                        {currentStudent.apaarId}
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                      <QrCode className="w-9 h-9 text-slate-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                        Student Name
                      </span>
                      <span className="font-display font-bold text-slate-900 dark:text-white text-sm">
                        {currentStudent.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                        College / Institution
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate block">
                        {currentStudent.currentInstitution}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-300 dark:border-slate-800/90 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                      {currentStudent.credentials.length} Sealed Certificates
                    </span>
                    {primaryCredential && (
                      <button
                        type="button"
                        onClick={() => onInspectCredential(primaryCredential)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Certificate</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-3 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                    <span>APAAR VAULT SEALED</span>
                    <span>7/7 OCR VERIFIED</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-[10px] text-slate-300 space-y-1">
                    <div className="truncate">
                      <span className="text-slate-400">Vault DB: </span>
                      <span className="text-amber-300">
                        ai-studio-apaarstudentregi-c7b5f2d9-407c-48f5-be20-e42be25d8bde
                      </span>
                    </div>
                    <div className="truncate">
                      <span className="text-slate-400">SHA-256: </span>
                      <span className="text-emerald-400">
                        {primaryCredential?.sha256Hash ||
                          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                      </span>
                    </div>
                  </div>
                  {primaryCredential && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onInspectCredential(primaryCredential)}
                        className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Open & OCR Verify Certificate</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Student Selector */}
              <div className="pt-2 border-t border-slate-700/70 flex items-center justify-between gap-2 text-[11px]">
                <label
                  htmlFor="smart-pass-student-select"
                  className="text-slate-700 dark:text-slate-300 font-semibold shrink-0"
                >
                  Change Student:
                </label>
                <select
                  id="smart-pass-student-select"
                  value={currentStudent.apaarId}
                  onChange={e => onSelectStudent(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-900 dark:text-amber-300 font-mono font-semibold focus:outline-none focus:border-amber-400"
                >
                  {students.map(s => (
                    <option key={s.apaarId} value={s.apaarId}>
                      {s.name} ({s.apaarId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right 7 Cols: 3 Simple One-Click Actions */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-slate-50/90 dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Quick Actions — Choose What to Do in 1 Click
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any card below to verify a document with OCR, run an HR check, or open the Student Vault.
                  </p>
                </div>
              </div>

              {/* 3 Big, Simple, Visual Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Action 1: OCR Document Scanner */}
                <button
                  type="button"
                  onClick={() => onSelectTab('doc-verification')}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    activeTab === 'doc-verification'
                      ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                      <ScanText className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      1. OCR Document Verify
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Upload any certificate PDF/Image or scan Vault files via 7-field OCR.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Scan Certificate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 2: HR Candidate Check & Approval */}
                <button
                  type="button"
                  onClick={() => onSelectTab('employer-bgv')}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    activeTab === 'employer-bgv'
                      ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-amber-500/60 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      2. HR Check & Verify
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      HR checks candidate APAAR ID, runs OCR verification & approves BGV.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span>Open HR Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 3: Student Personal Vault & Consent */}
                <button
                  type="button"
                  onClick={() => onSelectTab('student-portal')}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    activeTab === 'student-portal'
                      ? 'bg-sky-500/15 border-sky-500 ring-2 ring-sky-500/20'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-sky-500/60 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <FolderLock className="w-5 h-5" />
                      </div>
                      {pendingConsentCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold">
                          {pendingConsentCount} Pending
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      3. Student Vault
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Upload documents to APAAR Vault & approve or reject HR requests.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400">
                    <span>Open My Vault</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
