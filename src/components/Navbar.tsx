/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Search,
  Users,
  BarChart3,
  History,
  Bell,
  FileCheck2,
  UserPlus,
  Sun,
  Moon,
  HelpCircle,
  ChevronDown,
  Building2,
  GraduationCap,
  Briefcase,
  ShieldAlert,
  Check,
  PlusCircle,
  LogOut,
  Layers,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { UserAccount, UserRole } from '../types/auth';

export type ActiveTab =
  | 'employer-bgv'
  | 'doc-verification'
  | 'student-portal'
  | 'registry'
  | 'lookup'
  | 'insights'
  | 'audit-trail';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingConsentCount: number;
  activeStudentName: string;
  onOpenNotificationModal?: () => void;
  onOpenCreateStudentModal?: () => void;
  onOpenCreateAccountModal?: () => void;
  onOpenGuideModal?: () => void;
  unreadAlertCount?: number;
  currentUser: UserAccount;
  allAccounts: UserAccount[];
  onSelectUser: (user: UserAccount) => void;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingConsentCount,
  onOpenNotificationModal,
  onOpenCreateAccountModal,
  onOpenGuideModal,
  unreadAlertCount = 0,
  currentUser,
  allAccounts,
  onSelectUser,
  onSignOut,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'STUDENT':
        return {
          icon: <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Student',
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        };
      case 'EMPLOYER':
        return {
          icon: <Building2 className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Company HR',
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        };
      case 'INSTITUTION':
        return {
          icon: <Briefcase className="w-3.5 h-3.5 text-blue-500" />,
          label: 'College',
          bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
        };
      case 'REGULATOR':
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />,
          label: 'Auditor',
          bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
        };
    }
  };

  const activeRoleBadge = getRoleBadge(currentUser.role);
  const isSecondaryTabActive =
    activeTab === 'lookup' || activeTab === 'insights' || activeTab === 'audit-trail';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0c121d]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Zone 1: Simple & Clear Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-base shadow-xs">
              A
            </div>
            <div>
              <span className="font-display font-bold text-slate-900 dark:text-slate-100 text-base tracking-tight block leading-none">
                APAAR Vault
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Simple OCR & ID Verification
              </span>
            </div>
          </div>

          {/* Zone 2: 4 Simple Primary Navigation Buttons + More Dropdown */}
          <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Main Navigation">
            <button
              type="button"
              onClick={() => setActiveTab('employer-bgv')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'employer-bgv'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>1. HR Verify</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('doc-verification')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'doc-verification'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>2. OCR Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('student-portal')}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'student-portal'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>3. Student Vault</span>
              {pendingConsentCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-md bg-rose-500 text-white">
                  {pendingConsentCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('registry')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'registry'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>4. Students</span>
            </button>

            {/* Secondary Views Dropdown ("More") */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isSecondaryTabActive
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>More</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute left-0 mt-2 w-52 rounded-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('lookup');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      activeTab === 'lookup'
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Search className="w-4 h-4 text-amber-500" />
                    <span>APAAR ID Lookup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('insights');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      activeTab === 'insights'
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    <span>Registry Insights</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('audit-trail');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      activeTab === 'audit-trail'
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <History className="w-4 h-4 text-purple-500" />
                    <span>Security Audit Trail</span>
                  </button>

                  {onOpenGuideModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenGuideModal();
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      <span>How It Works (Guide)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Theme, Notifications & Account Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {onOpenNotificationModal && (
              <button
                type="button"
                onClick={onOpenNotificationModal}
                className="relative p-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                title="View Alerts"
              >
                <Bell className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                {unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-md bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadAlertCount}
                  </span>
                )}
              </button>
            )}

            {/* Active User Account Switcher Menu */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen(prev => !prev)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all text-xs cursor-pointer"
                title="Switch User Role"
                aria-expanded={isAccountMenuOpen}
              >
                <div
                  className={`w-6 h-6 rounded-lg ${currentUser.avatarBg || 'bg-amber-500'} text-white font-bold flex items-center justify-center text-[11px]`}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white max-w-[96px] truncate">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${activeRoleBadge.bg}`}
                  >
                    {activeRoleBadge.label}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isAccountMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-700 shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      1-Click Switch Role
                    </div>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {allAccounts.map(account => {
                      const badge = getRoleBadge(account.role);
                      const isSelected = account.id === currentUser.id;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            onSelectUser(account);
                            setIsAccountMenuOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors ${
                            isSelected ? 'bg-amber-500/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg ${account.avatarBg || 'bg-amber-500'} text-white font-bold flex items-center justify-center text-xs shrink-0`}
                            >
                              {account.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {account.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {badge.label} · {account.organization}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1 px-2 flex flex-col gap-1">
                    {onOpenCreateAccountModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          onOpenCreateAccountModal();
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 flex items-center gap-2"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Create New Account</span>
                      </button>
                    )}
                    {onSignOut && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          onSignOut();
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Switch Login / Sign Out</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
