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
          activeClass: 'bg-[#E05A47] text-white border-[#E05A47] shadow-sm',
        };
      case 'STUDENT':
        return {
          label: 'Student',
          icon: <GraduationCap className="w-3.5 h-3.5" />,
          activeClass: 'bg-[#0D766E] text-white border-[#0D766E] shadow-sm',
        };
      case 'INSTITUTION':
        return {
          label: 'College',
          icon: <Briefcase className="w-3.5 h-3.5" />,
          activeClass: 'bg-[#2563EB] text-white border-[#2563EB] shadow-sm',
        };
      case 'REGULATOR':
        return {
          label: 'Auditor',
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
          activeClass: 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm',
        };
    }
  };

  return (
    <section
      aria-label="APAAR Smart Pass and Quick Actions"
      className="border-b border-[#E8E2D8] dark:border-[#2D2D32] bg-[#FAF8F5]/90 dark:bg-[#18181B]/90 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Top Simple Bar: 1-Tap Role Switcher + Quick Student Search + Collapse Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: 1-Tap Role Switcher Dock */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 mr-1">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isCurrent
                      ? meta.activeClass
                      : 'bg-[#F3EFEA] dark:bg-[#27272A] text-stone-700 dark:text-stone-300 border-[#E5E0D6] dark:border-[#38383E] hover:bg-[#EAE4DA] dark:hover:bg-[#323238]'
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
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                placeholder="Search student or 12-digit APAAR ID..."
                aria-label="Search student or 12-digit APAAR ID"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#242427] border border-[#E5E0D6] dark:border-[#38383E] text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-[#E05A47]"
              />
              {matchingStudents.length > 0 && (
                <div className="absolute right-0 left-0 mt-1.5 bg-white dark:bg-[#242427] border border-[#E5E0D6] dark:border-[#38383E] rounded-2xl shadow-xl z-50 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
                  {matchingStudents.map(s => (
                    <div
                      key={s.apaarId}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-[#FAF8F5] dark:hover:bg-[#2A2A30] text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 dark:text-white truncate">
                          {s.name}
                        </div>
                        <div className="font-mono text-[10px] text-[#E05A47] font-semibold tabular-nums">
                          {s.apaarId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStudent(s.apaarId);
                            onSelectTab('employer-bgv');
                            setQuickSearch('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#E05A47] text-white font-semibold text-[10px] cursor-pointer"
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
                          className="px-2.5 py-1 rounded-lg bg-[#0D766E] text-white font-semibold text-[10px] cursor-pointer"
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeckExpanded(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3EFEA] dark:bg-[#27272A] hover:bg-[#EAE4DA] dark:hover:bg-[#323238] text-stone-700 dark:text-stone-300 border border-[#E5E0D6] dark:border-[#38383E] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Fingerprint className="w-3.5 h-3.5 text-[#E05A47]" />
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
          <div className="mt-4 pt-4 border-t border-[#E8E2D8] dark:border-[#2D2D32] grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left 5 Cols: Interactive Flippable APAAR Smart Identity Pass (Warm Card Design) */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5EFE4] dark:from-[#242427] dark:to-[#1C1C1F] border border-[#E2DDD4] dark:border-[#38383E] p-5 shadow-[0_6px_24px_-4px_rgba(28,25,23,0.08)] relative overflow-hidden apaar-card-engrave">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EAE5DC] dark:border-[#34343B]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#E05A47] to-[#C94634] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                    A
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-wide text-stone-900 dark:text-stone-100">
                      APAAR DIGITAL SMART CARD
                    </div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400">
                      12-Digit Student ID &amp; Cryptographic Vault Pass
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCardFlipped(prev => !prev)}
                  className="px-2.5 py-1 rounded-xl bg-stone-900/5 hover:bg-stone-900/10 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>{isCardFlipped ? 'Show Front' : 'Flip Card'}</span>
                </button>
              </div>

              {!isCardFlipped ? (
                <div className="py-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider block">
                        12-Digit APAAR ID
                      </span>
                      <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-[#E05A47] dark:text-[#F87171] tabular-nums">
                        {currentStudent.apaarId}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 border border-stone-200 shadow-xs">
                      <QrCode className="w-9 h-9 text-stone-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">
                        Student Name
                      </span>
                      <span className="font-display font-bold text-stone-900 dark:text-white text-sm">
                        {currentStudent.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block font-medium">
                        College / Institution
                      </span>
                      <span className="text-stone-800 dark:text-stone-200 font-medium truncate block">
                        {currentStudent.currentInstitution}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#EAE5DC] dark:border-[#34343B] flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                      {currentStudent.credentials.length} Sealed Certificates
                    </span>
                    {primaryCredential && (
                      <button
                        type="button"
                        onClick={() => onInspectCredential(primaryCredential)}
                        className="px-3 py-1 rounded-xl bg-[#0D766E] hover:bg-[#0B615B] text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Certificate</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-3.5 space-y-2.5 text-[11px]">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                    <span>APAAR VAULT SEALED</span>
                    <span>7/7 OCR VERIFIED</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 font-mono text-[10px] text-stone-700 dark:text-stone-300 space-y-1">
                    <div className="truncate">
                      <span className="text-stone-400">Vault DB: </span>
                      <span className="text-[#E05A47] font-semibold">
                        ai-studio-apaarstudentregi-c7b5f2d9-407c-48f5-be20-e42be25d8bde
                      </span>
                    </div>
                    <div className="truncate">
                      <span className="text-stone-400">SHA-256: </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
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
                        className="px-3 py-1.5 rounded-xl bg-[#0D766E] hover:bg-[#0B615B] text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Open &amp; OCR Verify Certificate</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Student Selector */}
              <div className="pt-2.5 border-t border-[#EAE5DC] dark:border-[#34343B] flex items-center justify-between gap-2 text-[11px]">
                <label
                  htmlFor="smart-pass-student-select"
                  className="text-stone-600 dark:text-stone-400 font-medium shrink-0"
                >
                  Change Student:
                </label>
                <select
                  id="smart-pass-student-select"
                  value={currentStudent.apaarId}
                  onChange={e => onSelectStudent(e.target.value)}
                  className="flex-1 bg-white dark:bg-[#1E1E22] border border-[#E5E0D6] dark:border-[#38383E] rounded-xl px-2 py-1 text-[11px] text-stone-900 dark:text-stone-100 font-mono font-medium focus:outline-none focus:border-[#E05A47]"
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
            <div className="lg:col-span-7 flex flex-col justify-between bg-white dark:bg-[#242427] border border-[#E8E2D8] dark:border-[#2D2D32] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                    Quick Actions — Choose What to Do in 1 Click
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Click any card below to verify a document with OCR, run an HR check, or open the Student Vault.
                  </p>
                </div>
              </div>

              {/* 3 Big, Simple, Visual Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Action 1: OCR Document Scanner */}
                <button
                  type="button"
                  onClick={() => onSelectTab('doc-verification')}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer card-hover-lift ${
                    activeTab === 'doc-verification'
                      ? 'bg-emerald-500/10 border-[#0D766E] ring-2 ring-emerald-500/20'
                      : 'bg-[#FAF8F5] dark:bg-[#1F1F23] border-[#E8E2D8] dark:border-[#38383E] hover:border-[#0D766E]/50'
                  }`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-[#0D766E] dark:text-emerald-400 flex items-center justify-center mb-3">
                      <ScanText className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm text-stone-900 dark:text-white">
                      1. OCR Document Verify
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                      Upload any certificate PDF/Image or scan Vault files via 7-field OCR.
                    </p>
                  </div>
                  <div className="mt-3.5 pt-2 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between text-xs font-semibold text-[#0D766E] dark:text-emerald-400">
                    <span>Scan Certificate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 2: HR Candidate Check & Approval */}
                <button
                  type="button"
                  onClick={() => onSelectTab('employer-bgv')}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer card-hover-lift ${
                    activeTab === 'employer-bgv'
                      ? 'bg-[#E05A47]/10 border-[#E05A47] ring-2 ring-[#E05A47]/20'
                      : 'bg-[#FAF8F5] dark:bg-[#1F1F23] border-[#E8E2D8] dark:border-[#38383E] hover:border-[#E05A47]/50'
                  }`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#E05A47]/15 text-[#E05A47] flex items-center justify-center mb-3">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm text-stone-900 dark:text-white">
                      2. HR Check &amp; Verify
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                      HR checks candidate APAAR ID, runs OCR verification &amp; approves BGV.
                    </p>
                  </div>
                  <div className="mt-3.5 pt-2 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between text-xs font-semibold text-[#E05A47]">
                    <span>Open HR Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Action 3: Student Personal Vault & Consent */}
                <button
                  type="button"
                  onClick={() => onSelectTab('student-portal')}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer card-hover-lift ${
                    activeTab === 'student-portal'
                      ? 'bg-sky-500/10 border-sky-600 ring-2 ring-sky-500/20'
                      : 'bg-[#FAF8F5] dark:bg-[#1F1F23] border-[#E8E2D8] dark:border-[#38383E] hover:border-sky-500/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <FolderLock className="w-5 h-5" />
                      </div>
                      {pendingConsentCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                          {pendingConsentCount} Pending
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-stone-900 dark:text-white">
                      3. Student Vault
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                      Upload documents to APAAR Vault &amp; approve or reject HR requests.
                    </p>
                  </div>
                  <div className="mt-3.5 pt-2 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between text-xs font-semibold text-sky-600 dark:text-sky-400">
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
