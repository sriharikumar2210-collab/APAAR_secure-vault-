/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Student, EducationStage, StudentStatus } from '../types';
import {
  generateValidApaarId,
  generatePenNumber,
  validateApaarId,
  createAcademicCredential,
  formatApaarId,
} from '../utils/verificationEngine';
import { generateApaarQrPayload } from '../utils/qrScanner';
import {
  UserPlus,
  ShieldCheck,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  Building,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  Lock,
} from 'lucide-react';

interface CreateStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentCreated: (
    newStudent: Student,
    options?: { navigateTo?: 'student-portal' | 'employer-bgv' | 'registry' }
  ) => void;
  existingApaarIds?: string[];
}

interface DemoPreset {
  label: string;
  badge: string;
  name: string;
  dob: string;
  gender: 'Female' | 'Male' | 'Other';
  institution: string;
  stage: EducationStage;
  gradeOrClass: string;
  district: string;
  degreeTitle: string;
  cgpa: string;
  yearOfPassing: number;
  phone: string;
  email: string;
  abcCredits: number;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    label: 'Engineering Graduate (B.Tech)',
    badge: 'UG · Anna Univ',
    name: 'Vigneshwaran K',
    dob: '14 Jun 2003',
    gender: 'Male',
    institution: 'College of Engineering, Guindy (Anna University)',
    stage: 'Graduated',
    gradeOrClass: 'Final Year Batch 2024',
    district: 'Chennai',
    degreeTitle: 'Bachelor of Engineering (B.E) - Computer Science & Engineering',
    cgpa: '8.94 CGPA (First Class with Distinction)',
    yearOfPassing: 2024,
    phone: '+91 90000 00031',
    email: 'vignesh.sample@student.example.edu.in',
    abcCredits: 168,
  },
  {
    label: 'Science & AI Graduate (B.Sc)',
    badge: 'UG · Loyola',
    name: 'Priyadarshini R',
    dob: '22 Aug 2004',
    gender: 'Female',
    institution: 'Loyola College, Autonomous, Chennai',
    stage: 'UG',
    gradeOrClass: 'Semester 6',
    district: 'Chennai',
    degreeTitle: 'Bachelor of Science (B.Sc) - Data Science & AI',
    cgpa: '9.20 CGPA',
    yearOfPassing: 2025,
    phone: '+91 90000 00032',
    email: 'priya.sample@student.example.edu.in',
    abcCredits: 142,
  },
  {
    label: 'Higher Secondary Student',
    badge: 'Class 12 · CBSE',
    name: 'Rohit Balaji',
    dob: '05 Nov 2007',
    gender: 'Male',
    institution: 'Kendriya Vidyalaya IIT Madras Campus',
    stage: 'Higher Secondary',
    gradeOrClass: 'Class 12 - PCM with CS',
    district: 'Chennai',
    degreeTitle: 'All India Senior School Certificate (CBSE Class 12)',
    cgpa: '94.2% Marks',
    yearOfPassing: 2025,
    phone: '+91 90000 00033',
    email: 'rohit.sample@student.example.edu.in',
    abcCredits: 0,
  },
];

export const CreateStudentModal: React.FC<CreateStudentModalProps> = ({
  isOpen,
  onClose,
  onStudentCreated,
  existingApaarIds = [],
}) => {
  // Form State
  const [apaarId, setApaarId] = useState(() => generateValidApaarId(existingApaarIds));
  const [pen, setPen] = useState(() => generatePenNumber(2024));
  const [name, setName] = useState('Vigneshwaran K');
  const [dob, setDob] = useState('14 Jun 2003');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Male');
  const [institution, setInstitution] = useState('College of Engineering, Guindy (Anna University)');
  const [stage, setStage] = useState<EducationStage>('Graduated');
  const [gradeOrClass, setGradeOrClass] = useState('Final Year Batch 2024');
  const [district, setDistrict] = useState('Chennai');
  const [status, setStatus] = useState<StudentStatus>('Graduated');
  const [contactEmail, setContactEmail] = useState('vignesh.sample@student.example.edu.in');
  const [contactPhone, setContactPhone] = useState('+91 90000 00031');
  const [abcCreditsBalance, setAbcCreditsBalance] = useState(168);
  const [hasDigilockerAccount, setHasDigilockerAccount] = useState(true);
  const [aadhaarMismatch, setAadhaarMismatch] = useState(false);
  const [degreeTitle, setDegreeTitle] = useState('Bachelor of Engineering (B.E) - Computer Science & Engineering');
  const [cgpaOrPercentage, setCgpaOrPercentage] = useState('8.94 CGPA (First Class with Distinction)');
  const [yearOfPassing, setYearOfPassing] = useState(2024);

  // Form Validation & Feedback
  const [apaarError, setApaarError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdStudentSuccess, setCreatedStudentSuccess] = useState<Student | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: DemoPreset) => {
    setName(preset.name);
    setDob(preset.dob);
    setGender(preset.gender);
    setInstitution(preset.institution);
    setStage(preset.stage);
    setGradeOrClass(preset.gradeOrClass);
    setDistrict(preset.district);
    setDegreeTitle(preset.degreeTitle);
    setCgpaOrPercentage(preset.cgpa);
    setYearOfPassing(preset.yearOfPassing);
    setContactPhone(preset.phone);
    setContactEmail(preset.email);
    setAbcCreditsBalance(preset.abcCredits);
    setStatus(preset.stage === 'Graduated' ? 'Graduated' : 'Active');
    setAadhaarMismatch(false);
    setHasDigilockerAccount(true);
    setFormError(null);
  };

  const handleGenerateNewApaar = () => {
    const newId = generateValidApaarId(existingApaarIds);
    setApaarId(newId);
    setApaarError(null);
  };

  const handleGenerateNewPen = () => {
    setPen(generatePenNumber(new Date().getFullYear()));
  };

  const handleApaarChange = (val: string) => {
    const formatted = formatApaarId(val);
    setApaarId(formatted);
    const valid = validateApaarId(formatted);
    if (!valid.isValid) {
      setApaarError(valid.error || 'Invalid APAAR format');
    } else {
      setApaarError(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setFormError('Student full name is required.');
      return;
    }

    if (!institution.trim()) {
      setFormError('Educational institution name is required.');
      return;
    }

    const validApaar = validateApaarId(apaarId);
    if (!validApaar.isValid) {
      setApaarError(validApaar.error || 'Invalid 12-digit APAAR ID');
      setFormError('Please enter or generate a valid 12-digit APAAR ID.');
      return;
    }

    // Generate verified academic credential
    const cleanApaar = apaarId.replace(/\s+/g, '');
    const credential = createAcademicCredential({
      type: 'DEGREE',
      title: degreeTitle,
      issuingInstitution: institution,
      issuingAuthority: 'Controller of Examinations & AICTE/NAD',
      yearOfPassing: Number(yearOfPassing) || 2024,
      cgpaOrPercentage: cgpaOrPercentage,
      specialization: degreeTitle.includes('-') ? degreeTitle.split('-')[1]?.trim() || 'General' : 'General',
      apaarIdClean: cleanApaar,
    });

    const newStudent: Student = {
      apaarId,
      pen: pen || generatePenNumber(),
      name: name.trim(),
      dob: dob.trim() || '01 Jan 2004',
      gender,
      currentInstitution: institution.trim(),
      stage,
      gradeOrClass: gradeOrClass.trim() || undefined,
      district: district.trim() || 'Chennai',
      status,
      aadhaarMismatch,
      consentPending: false,
      hasDigilockerAccount,
      digilockerDocumentsCount: hasDigilockerAccount ? 2 : 0,
      abcCreditsBalance: Number(abcCreditsBalance) || 0,
      contactEmail: contactEmail.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@student.ac.in`,
      contactPhone: contactPhone.trim() || '+91 90000 00030',
      credentials: hasDigilockerAccount ? [credential] : [],
    };

    setCreatedStudentSuccess(newStudent);
  };

  const handleFinishSuccess = (navigateTo?: 'student-portal' | 'employer-bgv' | 'registry') => {
    if (createdStudentSuccess) {
      onStudentCreated(createdStudentSuccess, { navigateTo });
      setCreatedStudentSuccess(null);
      onClose();
    }
  };

  const qrPayload = generateApaarQrPayload({
    apaarId,
    name: name || 'Student',
    dob: dob || '01 Jan 2004',
    gender,
    currentInstitution: institution || 'Institution',
    stage,
    gradeOrClass,
    district: district || 'Chennai',
    status,
    aadhaarMismatch,
    consentPending: false,
    hasDigilockerAccount,
    digilockerDocumentsCount: 2,
    abcCreditsBalance,
    contactEmail,
    contactPhone,
    credentials: [],
    pen,
  });


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#0d141e] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#111c2a] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Register New Student · APAAR Enrollment
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  NEP 2020 Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Issue 12-digit automated APAAR ID, UDISE+ PEN, and seal cryptographic APAAR Vault credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State Screen */}
        {createdStudentSuccess ? (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">
                Student Enrolled Successfully!
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                <span className="font-semibold text-amber-400">{createdStudentSuccess.name}</span> has been issued APAAR ID{' '}
                <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {createdStudentSuccess.apaarId}
                </span>{' '}
                and registered in the national education ledger.
              </p>
            </div>

            {/* Quick Summary Card */}
            <div className="max-w-md mx-auto bg-[#141e2e] border border-slate-800 rounded-xl p-4 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Permanent Education No (PEN):</span>
                <span className="font-mono text-slate-200">{createdStudentSuccess.pen}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Institution:</span>
                <span className="text-slate-200 font-medium truncate max-w-[240px]">
                  {createdStudentSuccess.currentInstitution}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">APAAR Vault Status:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sealed with 1 Certified Credential
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Academic Bank Credits (ABC):</span>
                <span className="font-mono text-amber-300 font-bold">
                  {createdStudentSuccess.abcCreditsBalance} Credits
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleFinishSuccess('student-portal')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Open Student Consent Portal</span>
              </button>

              <button
                type="button"
                onClick={() => handleFinishSuccess('employer-bgv')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify with Employer BGV</span>
              </button>

              <button
                type="button"
                onClick={() => handleFinishSuccess('registry')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors"
              >
                <span>Return to Registry</span>
              </button>
            </div>
          </div>
        ) : (
          /* Enrollment Form */
          <form onSubmit={handleFormSubmit} className="p-6 space-y-6">

            {/* Quick Demo Fillers / Presets */}
            <div className="bg-[#101824] border border-slate-800/90 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quick Test Presets (1-Click Fill)</span>
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Click any template to auto-populate authentic academic data
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DEMO_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-2 text-left rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white group-hover:text-amber-400 transition-colors">
                        {preset.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{preset.institution}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Alert if any */}
            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left Column: Personal & Academic Inputs (8 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                  <GraduationCap className="w-4 h-4" />
                  <span>Student Identity & Demographics</span>
                </h3>

                {/* Name & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      Full Legal Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="e.g. Vigneshwaran K"
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">Gender</label>
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value as any)}
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Date of Birth & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={dob}
                        onChange={e => setDob(e.target.value)}
                        placeholder="e.g. 14 Jun 2003"
                        className="w-full bg-[#111927] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      District / City
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        placeholder="e.g. Chennai, Salem, Coimbatore"
                        className="w-full bg-[#111927] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      Mobile Number (for SMS Alerts)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        placeholder="+91 90000 00031"
                        className="w-full bg-[#111927] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      Email Address (for Notices)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        placeholder="student@institution.ac.in"
                        className="w-full bg-[#111927] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-1.5 pt-2">
                  <Building className="w-4 h-4" />
                  <span>Academic Program & Enrollment</span>
                </h3>

                {/* Institution Name */}
                <div className="space-y-1 text-xs">
                  <label className="block text-slate-300 font-semibold">
                    Current Institution / University <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                    required
                    placeholder="e.g. College of Engineering Guindy (Anna University)"
                    className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Stage, Grade/Class, Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">Stage</label>
                    <select
                      value={stage}
                      onChange={e => setStage(e.target.value as EducationStage)}
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="UG">UG (Undergraduate)</option>
                      <option value="PG">PG (Postgraduate)</option>
                      <option value="Graduated">Graduated</option>
                      <option value="Higher Secondary">Higher Secondary (11-12)</option>
                      <option value="Secondary">Secondary (9-10)</option>
                      <option value="Middle">Middle (6-8)</option>
                      <option value="Primary">Primary (1-5)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">Grade / Year</label>
                    <input
                      type="text"
                      value={gradeOrClass}
                      onChange={e => setGradeOrClass(e.target.value)}
                      placeholder="e.g. 4th Year / Sem 8"
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">Status</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as StudentStatus)}
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Graduated">Graduated</option>
                      <option value="Dropped out">Dropped out</option>
                    </select>
                  </div>
                </div>

                {/* Degree / Marksheet Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      Degree / Qualification Title
                    </label>
                    <input
                      type="text"
                      value={degreeTitle}
                      onChange={e => setDegreeTitle(e.target.value)}
                      placeholder="e.g. B.Tech Computer Science"
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-300 font-semibold">
                      CGPA / Marks
                    </label>
                    <input
                      type="text"
                      value={cgpaOrPercentage}
                      onChange={e => setCgpaOrPercentage(e.target.value)}
                      placeholder="e.g. 8.94 CGPA"
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Statutory IDs & Card Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                  <Lock className="w-4 h-4" />
                  <span>Statutory National Identifiers</span>
                </h3>

                {/* APAAR ID Generator */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-semibold">
                      12-Digit APAAR ID <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateNewApaar}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono transition-colors"
                      title="Generate a fresh valid 12-digit number"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-Generate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={apaarId}
                      onChange={e => handleApaarChange(e.target.value)}
                      maxLength={14}
                      className={`w-full bg-[#111927] border rounded-lg px-3 py-2 text-amber-400 font-mono font-bold text-sm tracking-wider focus:outline-none transition-colors ${
                        apaarError ? 'border-rose-500' : 'border-slate-800 focus:border-amber-500'
                      }`}
                    />
                  </div>
                  {apaarError ? (
                    <p className="text-[11px] text-rose-400">{apaarError}</p>
                  ) : (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Valid Verhoeff checksum & format compliant
                    </p>
                  )}
                </div>

                {/* PEN (Permanent Education Number) */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-semibold">
                      11-Digit PEN (Permanent Education No.)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateNewPen}
                      className="text-[10px] text-slate-400 hover:text-slate-300 flex items-center gap-1 font-mono"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>New PEN</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={pen}
                    onChange={e => setPen(e.target.value)}
                    maxLength={11}
                    className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Academic Bank of Credits (ABC) */}
                <div className="space-y-1.5 text-xs">
                  <label className="block text-slate-300 font-semibold">
                    Academic Bank of Credits (ABC Balance)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={abcCreditsBalance}
                      onChange={e => setAbcCreditsBalance(Number(e.target.value))}
                      className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-slate-400 text-xs whitespace-nowrap">Credits</span>
                  </div>
                </div>

                {/* Toggles: APAAR Vault & Aadhaar */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-200">APAAR Secure Credential Vault</span>
                      <p className="text-[10px] text-slate-400">
                        Auto-seal signed cryptographic certificate into student Vault
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={hasDigilockerAccount}
                      onChange={e => setHasDigilockerAccount(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-200">Simulate Aadhaar Mismatch</span>
                      <p className="text-[10px] text-slate-400">
                        Mark record with demographic discrepancy for testing
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={aadhaarMismatch}
                      onChange={e => setAadhaarMismatch(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Mini APAAR Card Preview */}
                <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-[#0e1622] to-slate-900 border border-amber-500/30 text-white space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-[10px] font-bold text-slate-950">
                        A
                      </div>
                      <span className="text-[11px] font-bold tracking-tight text-slate-200">
                        MINISTRY OF EDUCATION · GOI
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      APAAR ID CARD
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div>
                      <p className="text-xs font-bold text-white">{name || 'Student Name'}</p>
                      <p className="text-[10px] text-slate-400">{institution || 'Institution'}</p>
                      <p className="font-mono text-xs font-bold text-amber-400 mt-1">
                        {apaarId}
                      </p>
                    </div>

                    <div className="w-12 h-12 bg-white rounded p-1 shrink-0 flex items-center justify-center">
                      <QrCode className="w-10 h-10 text-slate-950" />
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register & Issue APAAR ID</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
