/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  Building2,
  Briefcase,
  ShieldAlert,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  UserPlus,
  Fingerprint,
  Sparkles,
  Phone,
  User,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { UserAccount, UserRole, CreateAccountInput } from '../types/auth';
import { validateCreateAccount } from '../utils/authEngine';
import {
  loginWithPassword,
  loginWithDemoAccount,
  loginWithApaarOtp,
  requestApaarOtp,
  registerAccount,
  loginWithFirebaseIdToken,
} from '../services/authApi';
import { Student } from '../types';
import { auth, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { PrototypeBanner } from './PrototypeBanner';

interface LoginPageProps {
  accounts: UserAccount[];
  students: Student[];
  onLoginSuccess: (
    user: UserAccount,
    isNewAccount?: boolean,
    authMethodLabel?: string
  ) => void;
  onOpenGuideModal?: () => void;
  isRealtimeConnected?: boolean;
  totalVerifiedCount?: number;
  prefillEmail?: string;
}

type AuthTab = 'email-login' | 'apaar-otp' | 'register';

export const LoginPage: React.FC<LoginPageProps> = ({
  accounts,
  students,
  onLoginSuccess,
  onOpenGuideModal,
  isRealtimeConnected = true,
  totalVerifiedCount = 0,
  prefillEmail,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AuthTab>('email-login');

  // Tab 1: Email + PIN Login state
  const [email, setEmail] = useState(prefillEmail || accounts[0]?.email || 'v.sharma@tcs.example.com');
  const [pin, setPin] = useState('Apaar@2026');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginInfo, setLoginInfo] = useState<string | null>(
    prefillEmail
      ? 'Demo password (Apaar@2026) auto-filled. Click Sign In or select any role card below.'
      : null
  );
  const [isBusy, setIsBusy] = useState(false);

  // Tab 2: 12-Digit APAAR ID + OTP Login state
  const [apaarInput, setApaarInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [apaarError, setApaarError] = useState<string | null>(null);

  // Tab 3: Create New Account state
  const [regRole, setRegRole] = useState<UserRole>('STUDENT');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regDesignation, setRegDesignation] = useState('');
  const [regPhone, setRegPhone] = useState('+91 ');
  const [regApaarId, setRegApaarId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Format 12-digit APAAR ID cleanly as XXXX XXXX XXXX
  const formatApaar = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  // Handler: Email & password sign-in (checked by the server)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsBusy(true);
    const result = await loginWithPassword(email, pin);
    setIsBusy(false);
    if (!result.ok || !result.user) {
      setLoginError(result.error || 'Sign-in failed');
      return;
    }
    setPin('');
    onLoginSuccess(result.user, false, 'Email & password');
  };

  // Handler: 12-Digit APAAR ID + OTP sign-in (OTP issued and checked by the server)
  const handleApaarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setApaarError(null);
    setIsBusy(true);
    const result = await loginWithApaarOtp(apaarInput, otpInput);
    setIsBusy(false);
    if (!result.ok || !result.user) {
      setApaarError(result.error || 'Invalid APAAR ID or OTP');
      return;
    }
    setOtpInput('');
    onLoginSuccess(result.user, false, '12-Digit APAAR ID & OTP');
  };

  // Handler: ask the server to send an OTP for this APAAR ID
  const handleSendOtp = async (overrideApaar?: string) => {
    setApaarError(null);
    setOtpSentMessage(null);
    const targetApaar = overrideApaar ?? apaarInput;
    const digits = targetApaar.replace(/\s+/g, '');
    if (digits.length !== 12) {
      setApaarError('Enter a valid 12-digit APAAR ID first.');
      return;
    }
    const result = await requestApaarOtp(digits);
    if (!result.ok) {
      setApaarError(result.error || 'Could not send OTP');
      return;
    }
    if (result.devOtp) {
      setOtpInput(result.devOtp);
    }
    setOtpSentMessage(
      result.devOtp
        ? `OTP ${result.devOtp} generated & auto-filled! Click "Verify OTP & Open Student Locker" below.`
        : result.message || 'OTP sent.'
    );
  };

  // Handler: Register New Account (created on the server)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateAccountInput = {
      name: regName,
      email: regEmail,
      role: regRole,
      organization: regOrg,
      designation: regDesignation || undefined,
      phone: regPhone.trim() === '+91' ? undefined : regPhone,
      apaarId: regRole === 'STUDENT' && regApaarId.trim() ? regApaarId.trim() : undefined,
      passwordPin: regPassword,
    };

    const validation = validateCreateAccount(input);
    if (!validation.isValid) {
      setRegErrors(validation.errors);
      return;
    }

    setIsBusy(true);
    const result = await registerAccount({
      name: input.name,
      email: input.email,
      password: regPassword,
      role: input.role,
      organization: input.organization,
      designation: input.designation,
      phone: input.phone,
      apaarId: input.apaarId,
    });
    setIsBusy(false);
    if (!result.ok || !result.user) {
      setRegErrors({ form: result.error || 'Registration failed' });
      return;
    }
    setRegPassword('');
    onLoginSuccess(result.user, true, 'New account registration');
  };

  // Handler: Google sign-in via Firebase; the server verifies the Google token.
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setLoginError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      const result = await loginWithFirebaseIdToken(idToken);
      if (!result.ok || !result.user) {
        setLoginError(result.error || 'Google sign-in could not be verified.');
        return;
      }
      onLoginSuccess(result.user, false, 'Google sign-in');
    } catch {
      setLoginError('Google sign-in was cancelled or blocked by the browser. Use email or APAAR ID instead.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const [devDemoPassword, setDevDemoPassword] = useState<string>('Apaar@2026');

  React.useEffect(() => {
    fetch('/api/health')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.devDemoPassword) {
          setDevDemoPassword(data.devDemoPassword);
          setPin(prev => (prev === '' || prev === 'Apaar@2026' ? data.devDemoPassword : prev));
        }
      })
      .catch(() => {});
  }, []);

  // 1-Click Demo Role Sign-In: fills credentials AND signs in immediately
  const handleQuickRoleSelect = async (account: UserAccount) => {
    const activePass = devDemoPassword || 'Apaar@2026';
    setActiveTab('email-login');
    setEmail(account.email);
    setPin(activePass);
    setLoginError(null);
    setLoginInfo(`Signing in as ${account.name} (${account.role})...`);
    setIsBusy(true);
    const result = await loginWithDemoAccount(account.email, account.id);
    setIsBusy(false);
    if (result.ok && result.user) {
      onLoginSuccess(result.user, false, `1-Click Role Switch (${account.role})`);
      return;
    }
    setLoginInfo(
      `Email & password (${activePass}) filled for ${account.name}. Click "Sign In to Portal" to continue.`
    );
  };

  const getRoleMeta = (role: UserRole) => {
    switch (role) {
      case 'STUDENT':
        return {
          title: 'Student Candidate',
          tanglish: 'Maanavar Portal (Approve Consent & View APAAR)',
          icon: <GraduationCap className="w-4 h-4 text-emerald-500" />,
          accent: 'border-emerald-500/30 hover:border-emerald-500/70 bg-emerald-500/5',
        };
      case 'EMPLOYER':
        return {
          title: 'Employer HR & BGV',
          tanglish: 'Company HR (Verify Certificates & Request Consent)',
          icon: <Building2 className="w-4 h-4 text-amber-500" />,
          accent: 'border-amber-500/30 hover:border-amber-500/70 bg-amber-500/5',
        };
      case 'INSTITUTION':
        return {
          title: 'College / University',
          tanglish: 'Kalloori Registrar (Issue & Verify NAD Credentials)',
          icon: <Briefcase className="w-4 h-4 text-blue-500" />,
          accent: 'border-blue-500/30 hover:border-blue-500/70 bg-blue-500/5',
        };
      case 'REGULATOR':
        return {
          title: 'AICTE / MoE Auditor',
          tanglish: 'Regulator (Inspect Immutable DPDP Audit Logs)',
          icon: <ShieldAlert className="w-4 h-4 text-purple-500" />,
          accent: 'border-purple-500/30 hover:border-purple-500/70 bg-purple-500/5',
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c121d] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <PrototypeBanner />
      {/* Top Institutional Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-[#0c121d]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-base shadow-xs">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  APAAR REGISTRY · PROTOTYPE
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 hidden sm:inline">
                  One Nation, One Student ID
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Prototype · Self-Contained APAAR Secure Credential Vault & Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenGuideModal && (
              <button
                type="button"
                onClick={onOpenGuideModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>How It Works (Valikaatti)</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="flex-1 flex items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Authority Overview & 1-Click Role Switcher */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>DPDP Act 2023 · AICTE & APAAR Secure Vault Cryptographic Gateway</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Unified Academic Identity & Consent-Driven Verification Portal
              </h1>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Sign in with your <strong>12-Digit APAAR ID</strong>, official organization email, or select a live role below to issue verification requests, grant Aadhaar OTP student consent, and validate X.509 digital certificates in real time.
              </p>
            </div>

            {/* Key Registry Metrics */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {students.length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enrolled APAAR Students
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {totalVerifiedCount}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  PKI Verified Credentials
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {isRealtimeConnected ? 'Live Sync' : 'Ready'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cloud SQL + WebSocket
                </div>
              </div>
            </div>

            {/* 1-Click Demo Role Login Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1-Click Demo Role Sign-In (Click Any Card to Enter)
                </h2>
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  Demo Password: {devDemoPassword || 'Apaar@2026'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accounts.slice(0, 4).map(acc => {
                  const meta = getRoleMeta(acc.role);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleQuickRoleSelect(acc)}
                      className={`group text-left p-4 rounded-xl border transition-all bg-white dark:bg-[#111927] hover:shadow-md ${meta.accent}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-lg ${acc.avatarBg || 'bg-amber-500'} text-white font-bold flex items-center justify-center text-sm shrink-0`}
                          >
                            {acc.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                              {acc.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {acc.organization}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                          {meta.icon}
                          <span>{meta.title}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {acc.apaarId ? `APAAR: ${acc.apaarId}` : acc.email}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {meta.tanglish}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Login / Registration Card */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              {/* Segmented Mode Switcher */}
              <div className="p-2 bg-slate-100 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('email-login')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'email-login'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Email Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('apaar-otp')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'apaar-otp'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>APAAR ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'register'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New Account</span>
                </button>
              </div>

              <div className="p-6">
                {/* TAB 1: EMAIL & PIN LOGIN */}
                {activeTab === 'email-login' && (
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Portal Sign In (Kanakkuul Nuzhaiga)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Sign in using your registered Student, Employer HR, Institution, or Auditor email.
                      </p>
                    </div>

                    {loginInfo && !loginError && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                        <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{loginInfo}</span>
                      </div>
                    )}

                    {loginError && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Official or Student Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="name@organization.com"
                          required
                          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      {/* Quick email selector pills for convenience */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="text-slate-400">Fill:</span>
                        {accounts.slice(0, 4).map(acc => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setEmail(acc.email);
                              setPin(devDemoPassword || 'Apaar@2026');
                              setLoginError(null);
                              setLoginInfo(`Filled ${acc.name} (${acc.role}) & password. Click "Sign In to Portal".`);
                            }}
                            className="underline text-amber-600 dark:text-amber-400 hover:text-amber-500 font-medium mr-1.5"
                          >
                            {acc.role.toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Security PIN / Password
                        </label>
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                          Demo: {devDemoPassword || 'Apaar@2026'}
                        </span>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={pin}
                          onChange={e => setPin(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          required
                          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{isBusy ? 'Signing in…' : 'Sign In to Portal'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="relative py-1 flex items-center justify-center">
                      <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                      <span className="bg-white dark:bg-[#111927] px-3 text-[11px] text-slate-400 uppercase tracking-wider">
                        OR
                      </span>
                      <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading}
                      className="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>
                        {isGoogleLoading
                          ? 'Connecting to APAAR Vault / Google SSO...'
                          : 'Continue with Google / APAAR Secure Vault SSO'}
                      </span>
                    </button>
                  </form>
                )}

                {/* TAB 2: 12-DIGIT APAAR ID + AADHAAR OTP LOGIN */}
                {activeTab === 'apaar-otp' && (
                  <form onSubmit={handleApaarLogin} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        12-Digit APAAR ID Login
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Direct Student Sign-In using your 12-digit APAAR ID and Aadhaar-linked mobile OTP.
                      </p>
                    </div>

                    {apaarError && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{apaarError}</span>
                      </div>
                    )}

                    {otpSentMessage && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                        <span>{otpSentMessage}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        12-Digit Student APAAR ID
                      </label>
                      <input
                        type="text"
                        value={apaarInput}
                        onChange={e => setApaarInput(formatApaar(e.target.value))}
                        placeholder="2990 9583 2586"
                        required
                        className="w-full px-3.5 py-2.5 text-base font-mono tracking-wider rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="text-slate-400">Sample Enrolled IDs:</span>
                        {students.slice(0, 3).map(st => (
                          <button
                            key={st.apaarId}
                            type="button"
                            onClick={() => {
                              setApaarInput(st.apaarId);
                              setOtpInput('');
                              setApaarError(null);
                              void handleSendOtp(st.apaarId);
                            }}
                            className="font-mono underline text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                          >
                            {st.apaarId} ({st.name.split(' ')[0]})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          6-Digit Aadhaar / APAAR Vault OTP
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleSendOtp()}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Send / Auto-Fill OTP
                        </button>
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        autoComplete="one-time-code"
                        required
                        className="w-full px-3.5 py-2.5 text-base font-mono tracking-widest rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 disabled:opacity-60 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Fingerprint className="w-4 h-4" />
                      <span>Verify OTP & Open Student Locker</span>
                    </button>
                  </form>
                )}

                {/* TAB 3: CREATE NEW ACCOUNT */}
                {activeTab === 'register' && (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          Create Account (Puthiya Kanakku)
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Students, employers and institutions. Regulator accounts are issued by the Ministry.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const suffix = Math.floor(100 + Math.random() * 900);
                          if (regRole === 'STUDENT') {
                            setRegName('Karthik Raja M');
                            setRegEmail(`karthik.${suffix}@student.example.edu.in`);
                            setRegOrg('PSG College of Technology, Coimbatore');
                            setRegDesignation('Final Year B.E. CSE');
                            setRegPhone('+91 90000 00011');
                            setRegApaarId('');
                          } else if (regRole === 'EMPLOYER') {
                            setRegName('Priya Darshini');
                            setRegEmail(`priya.hr.${suffix}@zoho.example.com`);
                            setRegOrg('Zoho Corporation');
                            setRegDesignation('Campus Hiring & BGV Lead');
                            setRegPhone('+91 90000 00012');
                          } else {
                            setRegName('Dr. S. Muthukumaran');
                            setRegEmail(`coe.${suffix}@nitt.example.edu`);
                            setRegOrg('NIT Tiruchirappalli');
                            setRegDesignation('Controller of Examinations');
                            setRegPhone('+91 90000 00013');
                          }
                          setRegPassword('Apaar@2026');
                          setRegErrors({});
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold hover:bg-amber-500/20"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-Fill Sample</span>
                      </button>
                    </div>

                    {/* Role Selector */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['STUDENT', 'EMPLOYER', 'INSTITUTION'] as UserRole[]).map(
                        roleOption => (
                          <button
                            key={roleOption}
                            type="button"
                            onClick={() => {
                              setRegRole(roleOption);
                              setRegErrors({});
                            }}
                            className={`p-2 rounded-lg border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                              regRole === roleOption
                                ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            {getRoleMeta(roleOption).icon}
                            <span>{roleOption}</span>
                          </button>
                        )
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={regName}
                          onChange={e => setRegName(e.target.value)}
                          placeholder="Enter full name"
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                      {regErrors.name && (
                        <p className="text-[11px] text-rose-500">{regErrors.name}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={e => setRegEmail(e.target.value)}
                          placeholder="user@domain.com"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                        {regErrors.email && (
                          <p className="text-[11px] text-rose-500">{regErrors.email}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Mobile Number
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={regPhone}
                            onChange={e => setRegPhone(e.target.value)}
                            placeholder="+91 90000 00000"
                            className="w-full pl-8 pr-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {regRole === 'STUDENT'
                          ? 'College / University Name *'
                          : 'Organization / Institution Name *'}
                      </label>
                      <input
                        type="text"
                        value={regOrg}
                        onChange={e => setRegOrg(e.target.value)}
                        placeholder={
                          regRole === 'STUDENT'
                            ? 'e.g., Anna University, Chennai'
                            : 'e.g., Tata Consultancy Services'
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      {regErrors.organization && (
                        <p className="text-[11px] text-rose-500">{regErrors.organization}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Password * (8+ characters, a letter and a number)
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Choose a password"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      {regErrors.password && (
                        <p className="text-[11px] text-rose-500">{regErrors.password}</p>
                      )}
                    </div>

                    {regErrors.form && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-600 dark:text-rose-400">
                        {regErrors.form}
                      </div>
                    )}

                    {regRole === 'STUDENT' && (
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          12-Digit APAAR ID (Optional — a new one is issued if blank. Already have one? Use the APAAR ID tab.)
                        </label>
                        <input
                          type="text"
                          value={regApaarId}
                          onChange={e => setRegApaarId(formatApaar(e.target.value))}
                          placeholder="XXXX XXXX XXXX"
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account & Enter Workspace</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-[#090d16]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Hackathon prototype · Not an official Government of India website
          </div>
          <div className="flex items-center gap-3">
            <span>AICTE Central Root CA</span>
            <span aria-hidden="true">·</span>
            <span>APAAR Secure Vault HMAC-SHA256 PKI</span>
            <span aria-hidden="true">·</span>
            <span>Cloud SQL Real-Time Sync</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
