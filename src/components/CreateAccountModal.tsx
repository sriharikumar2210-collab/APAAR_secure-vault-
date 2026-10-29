/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserRole, CreateAccountInput, UserAccount } from '../types/auth';
import { validateCreateAccount } from '../utils/authEngine';
import { registerAccount } from '../services/authApi';
import { generateValidApaarId } from '../utils/verificationEngine';
import {
  X,
  UserCheck,
  Building2,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  KeyRound,
  Mail,
  User,
  Phone,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (account: UserAccount) => void;
  existingAccounts: UserAccount[];
  existingApaarIds?: string[];
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated,
  existingAccounts,
  existingApaarIds = [],
}) => {
  const [role, setRole] = useState<UserRole>('EMPLOYER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [apaarId, setApaarId] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdUserName, setCreatedUserName] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Preset demo accounts for rapid testing
  const applyPreset = (presetRole: UserRole, presetType: string) => {
    setRole(presetRole);
    setErrors({});
    if (presetType === 'employer') {
      setName('Sunil Narayanan (Sample)');
      setEmail('sunil.hr@employer.example.com');
      setOrganization('Sample Technologies Pvt Ltd');
      setDesignation('Campus Recruitment & Compliance Specialist');
      setPhone('+91 90000 00021');
      setApaarId('');
    } else if (presetType === 'institution') {
      setName('Prof. A. Seshadri (Sample)');
      setEmail('dean.academic@college.example.edu');
      setOrganization('Sample Institute of Technology');
      setDesignation('Dean of Academic Affairs');
      setPhone('+91 90000 00022');
      setApaarId('');
    } else if (presetType === 'student') {
      setName('Karthik Raja M (Sample)');
      setEmail('karthik.sample@student.example.edu.in');
      setOrganization('Anna University Regional Campus, Madurai');
      setDesignation('B.E. Mechanical Engineering (2022-2026)');
      setPhone('+91 90000 00023');
      setApaarId('');
    }
  };

  const handleGenerateApaarId = () => {
    const newId = generateValidApaarId(existingApaarIds);
    setApaarId(newId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateAccountInput = {
      name,
      email,
      role,
      organization,
      designation,
      phone,
      apaarId: role === 'STUDENT' ? apaarId : undefined,
      passwordPin: pin,
    };

    const validation = validateCreateAccount(input);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // The server creates the account, checks the APAAR ID is not someone else's,
    // and signs this browser in as the new account.
    setIsSubmitting(true);
    const result = await registerAccount({
      name,
      email,
      password: pin,
      role,
      organization,
      designation: designation || undefined,
      phone: phone || undefined,
      apaarId: role === 'STUDENT' && apaarId.trim() ? apaarId.trim() : undefined,
    });
    setIsSubmitting(false);
    if (!result.ok || !result.user) {
      setErrors({ form: result.error || 'Error creating account' });
      return;
    }
    const newAccount = result.user;
    setPin('');
    setIsSuccess(true);
    setCreatedUserName(newAccount.name);
    setTimeout(() => {
      onAccountCreated(newAccount);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-account-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#101826] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c121d]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="create-account-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
              >
                <span>Create New User Account</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Instant Access
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register as an Employer HR, Student or College Registrar (Regulator accounts are issued by the Ministry)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Account Created Successfully!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Welcome, <strong className="text-slate-900 dark:text-white">{createdUserName}</strong>. Your account has been saved and is now active. Switching to your role workspace...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Quick Demo Pre-fill Bar */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1-Click Test Demo Profiles (Sample Kanakku):</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('EMPLOYER', 'employer')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                >
                  🏢 Sample Employer HR
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('STUDENT', 'student')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                >
                  🎓 New Student Candidate
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('INSTITUTION', 'institution')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
                >
                  🏛️ Sample College Dean
                </button>
              </div>
            </div>

            {/* Role Selection Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Your Role (Pangku Therivu):
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('EMPLOYER')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    role === 'EMPLOYER'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Building2 className="w-5 h-5 mb-1.5 text-amber-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Employer HR
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      BGV & QR Verification
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole('STUDENT');
                    if (!apaarId) handleGenerateApaarId();
                  }}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    role === 'STUDENT'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <GraduationCap className="w-5 h-5 mb-1.5 text-emerald-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Student
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      APAAR ID & Consent
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('INSTITUTION')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    role === 'INSTITUTION'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Briefcase className="w-5 h-5 mb-1.5 text-blue-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Institution
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Registrar & NAD
                    </div>
                  </div>
                </button>

              </div>
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (Mulu Peyar) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.name}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (Official / Personal) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    placeholder="e.g. name@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Organization / Company / University */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {role === 'STUDENT'
                    ? 'College / University Name'
                    : 'Company / Organization Name'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={organization}
                    onChange={e => {
                      setOrganization(e.target.value);
                      if (errors.organization) setErrors(prev => ({ ...prev, organization: '' }));
                    }}
                    placeholder={
                      role === 'STUDENT'
                        ? 'e.g. Anna University Chennai'
                        : 'e.g. Tata Consultancy Services'
                    }
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                {errors.organization && (
                  <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.organization}
                  </p>
                )}
              </div>

              {/* Designation / Department */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {role === 'STUDENT' ? 'Degree & Major' : 'Official Designation'}
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    placeholder={
                      role === 'STUDENT'
                        ? 'e.g. B.Tech Information Technology'
                        : 'e.g. BGV Lead / HR Specialist'
                    }
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Phone (+91)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 90000 00000"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Student APAAR ID Binding (Only for Students) */}
              {role === 'STUDENT' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      12-Digit APAAR ID
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateApaarId}
                      className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      ⚡ Auto Generate
                    </button>
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={apaarId}
                      onChange={e => setApaarId(e.target.value)}
                      placeholder="xxxx xxxx xxxx"
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Password <span className="text-rose-500">*</span>{' '}
                <span className="text-slate-400 font-normal">(8+ characters, a letter and a number)</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Choose a password"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              {errors.password && <p className="mt-1 text-[11px] text-rose-500">{errors.password}</p>}
            </div>

            {errors.form && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold rounded-xl disabled:opacity-60 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all flex items-center gap-2 ring-1 ring-amber-400/50"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Creating…' : 'Create & Sign In'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
