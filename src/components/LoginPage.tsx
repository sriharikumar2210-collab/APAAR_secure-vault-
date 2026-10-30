/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Loader2,
  QrCode,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Laptop,
  Check,
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

type RoleTab = 'STUDENT' | 'EMPLOYER' | 'INSTITUTION' | 'REGULATOR' | 'REGISTER';

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

  // Active Role Tab (Tab-wise experience)
  const [activeTab, setActiveTab] = useState<RoleTab>('STUDENT');

  // WhatsApp Web style toggle: 'qr' vs 'phone-otp'
  const [pairingMode, setPairingMode] = useState<'qr' | 'phone-otp'>('qr');

  // Student auth mode: 'apaar-id' vs 'email'
  const [studentMode, setStudentMode] = useState<'apaar-id' | 'email'>('apaar-id');

  // Keep me signed in checkbox state (like WhatsApp Web)
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // QR scan state
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [qrKey, setQrKey] = useState(1);

  // Common credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Apaar@2026');
  const [isBusy, setIsBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginInfo, setLoginInfo] = useState<string | null>(null);

  // Student APAAR ID + OTP
  const [apaarInput, setApaarInput] = useState('2990 9583 2586');
  const [otpInput, setOtpInput] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [apaarError, setApaarError] = useState<string | null>(null);

  // Phone linking state (WhatsApp Web phone pairing)
  const [phoneNumber, setPhoneNumber] = useState('90000 00002');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  // Registration state
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
  const [devDemoPassword, setDevDemoPassword] = useState<string>('Apaar@2026');

  // Fetch demo password from server
  useEffect(() => {
    fetch('/api/health')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.devDemoPassword) {
          setDevDemoPassword(data.devDemoPassword);
          setPassword(data.devDemoPassword);
        }
      })
      .catch(() => {});
  }, []);

  // Update default credentials based on active role tab
  useEffect(() => {
    setLoginError(null);
    setApaarError(null);
    setOtpSentMessage(null);
    setLoginInfo(null);

    if (activeTab === 'STUDENT') {
      const acc = accounts.find(a => a.role === 'STUDENT') || accounts[1];
      if (acc) {
        setEmail(acc.email);
        if (acc.apaarId) setApaarInput(acc.apaarId);
        if (acc.phone) setPhoneNumber(acc.phone.replace('+91', '').trim());
      }
    } else if (activeTab === 'EMPLOYER') {
      const acc = accounts.find(a => a.role === 'EMPLOYER') || accounts[0];
      if (acc) setEmail(acc.email);
    } else if (activeTab === 'INSTITUTION') {
      const acc = accounts.find(a => a.role === 'INSTITUTION') || accounts[2];
      if (acc) setEmail(acc.email);
    } else if (activeTab === 'REGULATOR') {
      const acc = accounts.find(a => a.role === 'REGULATOR') || accounts[3];
      if (acc) setEmail(acc.email);
    }
    setPassword(devDemoPassword || 'Apaar@2026');
  }, [activeTab, accounts, devDemoPassword]);

  // Clean 12-digit formatter
  const formatApaar = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  // Target account for current role
  const getCurrentRoleAccount = () => {
    if (activeTab === 'REGISTER') return accounts[0];
    return accounts.find(a => a.role === activeTab) || accounts[0];
  };

  // Simulated WhatsApp Web QR Scan Login
  const handleSimulateQrScan = async () => {
    setIsScanningQr(true);
    setLoginError(null);
    const targetAccount = getCurrentRoleAccount();
    setTimeout(async () => {
      const result = await loginWithDemoAccount(targetAccount.email, targetAccount.id);
      setIsScanningQr(false);
      if (result.ok && result.user) {
        onLoginSuccess(result.user, false, 'DigiLocker QR Code Instant Link');
      } else {
        setLoginError('QR scan failed to authenticate. Please sign in below.');
      }
    }, 700);
  };

  // Email & Password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsBusy(true);
    const result = await loginWithPassword(email, password);
    setIsBusy(false);
    if (!result.ok || !result.user) {
      setLoginError(result.error || 'Sign-in failed. Please verify credentials.');
      return;
    }
    onLoginSuccess(result.user, false, `${activeTab} Email Sign-In`);
  };

  // APAAR ID + OTP login
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
    onLoginSuccess(result.user, false, '12-Digit APAAR ID & Aadhaar OTP');
  };

  // Send APAAR OTP
  const handleSendOtp = async (targetApaarId?: string) => {
    setApaarError(null);
    setOtpSentMessage(null);
    const target = targetApaarId || apaarInput;
    const digits = target.replace(/\s+/g, '');
    if (digits.length !== 12) {
      setApaarError('Please enter a valid 12-digit APAAR ID.');
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
        ? `OTP ${result.devOtp} generated & auto-filled! Click "Verify & Open Student Locker".`
        : result.message || 'OTP sent to registered Aadhaar mobile.'
    );
  };

  // Phone linking login (WhatsApp style "Link with phone number")
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    const stuAcc = accounts.find(a => a.role === 'STUDENT') || accounts[1];
    const result = await loginWithDemoAccount(stuAcc.email, stuAcc.id);
    setIsBusy(false);
    if (result.ok && result.user) {
      onLoginSuccess(result.user, false, 'Mobile Number Linked Device');
    } else {
      setLoginError('Could not verify mobile OTP.');
    }
  };

  // 1-Click Demo role login
  const handleQuickLoginRole = async (role: UserRole) => {
    const acc = accounts.find(a => a.role === role);
    if (!acc) return;
    setIsBusy(true);
    setLoginError(null);
    const result = await loginWithDemoAccount(acc.email, acc.id);
    setIsBusy(false);
    if (result.ok && result.user) {
      onLoginSuccess(result.user, false, `1-Click Demo (${role})`);
    } else {
      setEmail(acc.email);
      setPassword(devDemoPassword || 'Apaar@2026');
      setLoginInfo(`Filled credentials for ${acc.name}. Click Sign In.`);
    }
  };

  // Register New Account
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

  // Google SSO
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
      setLoginError('Google sign-in cancelled or blocked.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#111B21] text-stone-900 dark:text-[#E9EDEF] flex flex-col justify-between selection:bg-[#00A884] selection:text-white transition-colors">
      <PrototypeBanner />

      {/* WhatsApp Web Signature Top Header Banner */}
      <div className="w-full bg-[#00A884] dark:bg-[#202C33] text-white pt-6 pb-28 px-4 sm:px-8 shadow-sm transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-heading font-black text-white text-xl shadow-inner">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold tracking-tight text-lg text-white">
                  APAAR WEB
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white/20 text-white tracking-wide uppercase">
                  DigiLocker Linked
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                Automated Permanent Academic Account Registry · Ministry of Education
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenGuideModal && (
              <button
                type="button"
                onClick={onOpenGuideModal}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Guide</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main WhatsApp Web Style Floating Card Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 -mt-20 sm:-mt-22 mb-10 z-10">
        <div className="bg-white dark:bg-[#1E262C] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 p-6 sm:p-10 transition-all">
          
          {/* TAB-WISE ROLE BAR (Top of WhatsApp Card) */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Select Your Portal Role (Tab-Wise)
              </span>
              <span className="text-[11px] text-[#00A884] dark:text-[#00A884] font-semibold">
                ● Ready to link device
              </span>
            </div>

            <div className="p-1.5 rounded-2xl bg-stone-100 dark:bg-[#111B21] grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('STUDENT')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'STUDENT'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('EMPLOYER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'EMPLOYER'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Employer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('INSTITUTION')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'INSTITUTION'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>College</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('REGULATOR')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'REGULATOR'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Auditor</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('REGISTER')}
                className={`col-span-2 sm:col-span-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'REGISTER'
                    ? 'bg-white dark:bg-[#202C33] text-[#00A884] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Register</span>
              </button>
            </div>
          </div>

          {/* TWO-COLUMN WHATSAPP WEB LAYOUT (Instructions on Left, QR Code on Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* LEFT COLUMN (60%): Numbered Step Instructions & Form Options */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-stone-900 dark:text-white tracking-tight">
                  To use APAAR on your computer:
                </h1>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Connect your session seamlessly via QR scan, 12-digit APAAR ID, or official credentials.
                </p>
              </div>

              {/* Numbered Steps (Classic WhatsApp Web Design) */}
              <ol className="space-y-3.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#00A884]/15 text-[#00A884] font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open <strong>DigiLocker</strong> or the <strong>APAAR Sovereign App</strong> on your mobile device.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#00A884]/15 text-[#00A884] font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices (APAAR Web)</strong>.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#00A884]/15 text-[#00A884] font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Point your camera at the QR code, or <strong>click the QR code</strong> to simulate instant scan login.
                  </span>
                </li>
              </ol>

              {/* Role-Specific Detail Card / Fallback Form */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#111B21] border border-stone-200/80 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      {activeTab === 'STUDENT'
                        ? '🎓 Student Candidate Locker'
                        : activeTab === 'EMPLOYER'
                        ? '🏢 Tata Consultancy Services (HR)'
                        : activeTab === 'INSTITUTION'
                        ? '🏛️ Anna University (Registrar)'
                        : activeTab === 'REGULATOR'
                        ? '⚖️ AICTE / MoE Audit Bureau'
                        : '📝 New Account Registration'}
                    </span>
                  </div>
                  {activeTab !== 'REGISTER' && (
                    <button
                      type="button"
                      onClick={() => handleQuickLoginRole(activeTab as UserRole)}
                      disabled={isBusy}
                      className="px-2.5 py-1 rounded-lg bg-[#00A884] text-white text-[11px] font-bold hover:bg-[#008f6f] transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>1-Click Sign-In</span>
                    </button>
                  )}
                </div>

                {/* TAB CONTENT: STUDENT INPUT */}
                {activeTab === 'STUDENT' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 text-[11px]">Direct 12-Digit APAAR Login:</span>
                      <button
                        type="button"
                        onClick={() => void handleSendOtp()}
                        className="text-[11px] text-[#00A884] font-semibold hover:underline cursor-pointer"
                      >
                        Auto-Fill Aadhaar OTP
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={apaarInput}
                        onChange={e => setApaarInput(formatApaar(e.target.value))}
                        placeholder="2990 9583 2586"
                        className="px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                      <input
                        type="text"
                        maxLength={6}
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-Digit OTP"
                        className="px-3 py-2 text-xs font-mono text-center tracking-widest rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                    </div>

                    {otpSentMessage && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {otpSentMessage}
                      </p>
                    )}
                    {apaarError && (
                      <p className="text-[11px] text-rose-500 font-medium">
                        {apaarError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleApaarLogin}
                      disabled={isBusy}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#00A884] hover:bg-[#008f6f] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Fingerprint className="w-4 h-4" />
                      <span>Verify OTP & Open Student Locker</span>
                    </button>
                  </div>
                )}

                {/* TAB CONTENT: EMPLOYER / INSTITUTION / REGULATOR CREDENTIALS */}
                {(activeTab === 'EMPLOYER' || activeTab === 'INSTITUTION' || activeTab === 'REGULATOR') && (
                  <form onSubmit={handleEmailLogin} className="space-y-2.5 pt-1">
                    {loginError && (
                      <p className="text-[11px] text-rose-500 font-medium">
                        {loginError}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Official email"
                        required
                        className="px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password (Apaar@2026)"
                        required
                        className="px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full py-2 px-3 rounded-xl bg-[#00A884] hover:bg-[#008f6f] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Sign In with Credentials</span>
                    </button>
                  </form>
                )}

                {/* TAB CONTENT: REGISTER */}
                {activeTab === 'REGISTER' && (
                  <form onSubmit={handleRegisterSubmit} className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        placeholder="Full Name"
                        required
                        className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={regOrg}
                        onChange={e => setRegOrg(e.target.value)}
                        placeholder="College or Company"
                        required
                        className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                      <input
                        type="password"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Password (min 8 chars)"
                        required
                        className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33] text-stone-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full py-2 px-3 rounded-xl bg-[#00A884] hover:bg-[#008f6f] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      Create Account & Link
                    </button>
                  </form>
                )}
              </div>

              {/* Link with phone number toggle (WhatsApp Web feature) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setPairingMode(pairingMode === 'qr' ? 'phone-otp' : 'qr')}
                  className="text-xs font-bold text-[#00A884] hover:underline cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {pairingMode === 'qr'
                      ? 'Link with phone number instead'
                      : 'Link with QR code instead'}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN (40%): THE ICONIC WHATSAPP WEB QR CODE BOX */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-stone-50/70 dark:bg-[#111B21]/60 rounded-3xl border border-stone-200/80 dark:border-stone-800">
              
              {pairingMode === 'qr' ? (
                <>
                  {/* The WhatsApp QR Code Container with Center APAAR Logo */}
                  <div
                    onClick={handleSimulateQrScan}
                    title="Click QR Code to simulate instant scan login"
                    className="group relative w-60 h-60 bg-white p-3 rounded-2xl border-2 border-stone-200 dark:border-stone-700 shadow-md flex items-center justify-center cursor-pointer hover:border-[#00A884] hover:shadow-lg transition-all"
                  >
                    {/* Authentic SVG QR Code Matrix */}
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full text-stone-900 transition duration-200 group-hover:scale-[0.98]"
                      fill="currentColor"
                    >
                      {/* Top-left position marker */}
                      <rect x="5" y="5" width="26" height="26" rx="4" />
                      <rect x="9" y="9" width="18" height="18" fill="white" rx="2" />
                      <rect x="13" y="13" width="10" height="10" rx="1.5" />

                      {/* Top-right position marker */}
                      <rect x="69" y="5" width="26" height="26" rx="4" />
                      <rect x="73" y="9" width="18" height="18" fill="white" rx="2" />
                      <rect x="77" y="13" width="10" height="10" rx="1.5" />

                      {/* Bottom-left position marker */}
                      <rect x="5" y="69" width="26" height="26" rx="4" />
                      <rect x="9" y="73" width="18" height="18" fill="white" rx="2" />
                      <rect x="13" y="77" width="10" height="10" rx="1.5" />

                      {/* Decorative Matrix Patterns */}
                      <rect x="36" y="8" width="5" height="5" />
                      <rect x="44" y="8" width="5" height="5" />
                      <rect x="52" y="8" width="5" height="5" />
                      <rect x="60" y="8" width="5" height="5" />

                      <rect x="8" y="36" width="5" height="5" />
                      <rect x="8" y="44" width="5" height="5" />
                      <rect x="8" y="52" width="5" height="5" />
                      <rect x="8" y="60" width="5" height="5" />

                      <rect x="36" y="20" width="6" height="6" />
                      <rect x="46" y="20" width="6" height="6" />
                      <rect x="56" y="20" width="6" height="6" />

                      <rect x="69" y="36" width="5" height="5" />
                      <rect x="78" y="36" width="5" height="5" />
                      <rect x="86" y="36" width="5" height="5" />

                      <rect x="69" y="46" width="5" height="5" />
                      <rect x="78" y="46" width="5" height="5" />
                      <rect x="86" y="46" width="5" height="5" />

                      <rect x="36" y="69" width="5" height="5" />
                      <rect x="46" y="69" width="5" height="5" />
                      <rect x="56" y="69" width="5" height="5" />

                      <rect x="36" y="78" width="5" height="5" />
                      <rect x="46" y="78" width="5" height="5" />
                      <rect x="56" y="78" width="5" height="5" />

                      <rect x="69" y="69" width="6" height="6" />
                      <rect x="82" y="69" width="6" height="6" />
                      <rect x="69" y="82" width="6" height="6" />
                      <rect x="82" y="82" width="6" height="6" />
                    </svg>

                    {/* Centered APAAR Emblem Inside QR */}
                    <div className="absolute inset-0 m-auto w-12 h-12 bg-white rounded-xl shadow-md border-2 border-stone-200 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-lg bg-[#00A884] flex items-center justify-center text-white font-heading font-black text-sm">
                        A
                      </div>
                    </div>

                    {/* Subtle Scan Overlay on Hover */}
                    <div className="absolute inset-0 bg-[#00A884]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
                      <span className="bg-stone-900/80 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md">
                        Click to Scan
                      </span>
                    </div>

                    {/* Scanning animation */}
                    {isScanningQr && (
                      <div className="absolute inset-0 bg-white/90 dark:bg-stone-900/90 rounded-2xl flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-[#00A884] animate-spin" />
                        <span className="text-xs font-bold text-[#00A884]">
                          Connecting device…
                        </span>
                      </div>
                    )}
                  </div>

                  {/* QR Controls & Actions */}
                  <div className="mt-4 text-center space-y-2">
                    <button
                      type="button"
                      onClick={handleSimulateQrScan}
                      disabled={isScanningQr}
                      className="px-4 py-2 rounded-xl bg-[#00A884] hover:bg-[#008f6f] text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Instant Scan as {activeTab}</span>
                    </button>

                    <div className="flex items-center justify-center gap-2 pt-1 text-xs text-stone-600 dark:text-stone-400">
                      <input
                        type="checkbox"
                        id="keepSigned"
                        checked={keepSignedIn}
                        onChange={e => setKeepSignedIn(e.target.checked)}
                        className="rounded text-[#00A884] focus:ring-[#00A884] cursor-pointer"
                      />
                      <label htmlFor="keepSigned" className="cursor-pointer text-[11px]">
                        Stay logged in on this browser
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                /* Phone linking form (WhatsApp Web Phone Number screen) */
                <form onSubmit={handlePhoneLogin} className="w-full max-w-xs space-y-3.5">
                  <div className="text-center">
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                      Enter phone number
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      Select country and enter your Aadhaar linked mobile
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202C33]">
                      <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
                        🇮🇳 +91
                      </span>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="90000 00002"
                        className="w-full text-xs font-mono bg-transparent text-stone-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setPhoneOtpSent(true)}
                      className="w-full py-1.5 text-xs text-[#00A884] font-semibold hover:underline"
                    >
                      {phoneOtpSent ? 'OTP Sent (Auto-Filled)' : 'Request OTP Code'}
                    </button>

                    {phoneOtpSent && (
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-mono tracking-widest text-[#00A884] font-bold">
                        CODE: 829-410
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#00A884] hover:bg-[#008f6f] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                  >
                    Confirm & Link Device
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* WhatsApp Web Help & Tutorial Section */}
      <footer className="w-full py-6 px-4 text-center text-xs text-stone-500 dark:text-stone-400 border-t border-stone-200 dark:border-stone-800/60 bg-white/40 dark:bg-[#111B21]/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400 text-xs">
            <Lock className="w-3.5 h-3.5 text-[#00A884]" />
            <span>End-to-end encrypted with AICTE Central Root CA & DPDP Act 2023.</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>One Nation, One Student ID</span>
            <span>·</span>
            <span>DigiLocker NAD Gateway</span>
            <span>·</span>
            <button
              type="button"
              onClick={onOpenGuideModal}
              className="text-[#00A884] hover:underline font-semibold"
            >
              Need help to get started?
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
