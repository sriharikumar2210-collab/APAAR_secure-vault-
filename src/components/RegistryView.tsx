/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Student } from '../types';
import {
  Search,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  X,
  Sparkles,
  UserPlus,
  Users,
  GraduationCap,
  AlertTriangle,
  FileCheck2,
  Filter,
} from 'lucide-react';


interface RegistryViewProps {
  students: Student[];
  onSelectStudentForVerification: (apaarId: string) => void;
  onSelectStudentForConsent: (apaarId: string) => void;
  onApproveStudentApaar?: (student: Student) => void;
  onOpenCreateStudentModal?: () => void;
}


export const RegistryView: React.FC<RegistryViewProps> = ({
  students,
  onSelectStudentForVerification,
  onSelectStudentForConsent,
  onApproveStudentApaar,
  onOpenCreateStudentModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('All districts');
  const [selectedStage, setSelectedStage] = useState('All stages');
  const [selectedIssue, setSelectedIssue] = useState('All records');

  const districts = useMemo(() => {
    const list = Array.from(new Set(students.map(s => s.district))).sort();
    return ['All districts', ...list];
  }, [students]);

  const stages = useMemo(() => {
    return [
      'All stages',
      'Primary',
      'Middle',
      'Secondary',
      'Higher Secondary',
      'UG',
      'PG',
      'Graduated',
      'Left education',
    ];
  }, []);

  const issues = ['All records', 'Aadhaar Mismatch', 'Consent Pending', 'Dropped out'];

  // Summary Metrics
  const totalCount = students.length;
  const activeCount = useMemo(() => students.filter(s => s.status === 'Active').length, [students]);
  const graduatedCount = useMemo(() => students.filter(s => s.status === 'Graduated').length, [students]);
  const consentPendingCount = useMemo(() => students.filter(s => s.consentPending).length, [students]);
  const mismatchCount = useMemo(() => students.filter(s => s.aadhaarMismatch).length, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Real-time search filtering by APAAR ID, student name, or institution
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const cleanQuery = query.replace(/\s+/g, '');
        const cleanApaar = student.apaarId.replace(/\s+/g, '').toLowerCase();

        // 1. Check APAAR ID (formatted with spaces or contiguous digits)
        const matchesApaar =
          student.apaarId.toLowerCase().includes(query) ||
          cleanApaar.includes(cleanQuery);

        // 2. Check student name
        const matchesName = student.name.toLowerCase().includes(query);

        // 3. Check institution name
        const matchesInst = student.currentInstitution.toLowerCase().includes(query);

        // 4. Check PEN (Permanent Education Number)
        const matchesPen = student.pen.toLowerCase().includes(cleanQuery);

        if (!matchesName && !matchesApaar && !matchesInst && !matchesPen) {
          return false;
        }
      }

      // District filter
      if (selectedDistrict !== 'All districts' && student.district !== selectedDistrict) {
        return false;
      }

      // Stage filter
      if (selectedStage !== 'All stages' && student.stage !== selectedStage) {
        return false;
      }

      // Data issue filter
      if (selectedIssue === 'Aadhaar Mismatch' && !student.aadhaarMismatch) return false;
      if (selectedIssue === 'Consent Pending' && !student.consentPending) return false;
      if (selectedIssue === 'Dropped out' && student.status !== 'Dropped out') return false;

      return true;
    });
  }, [students, searchTerm, selectedDistrict, selectedStage, selectedIssue]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Heading & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">National APAAR Registry</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Live Verified Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, and onboard student records with tamper-proof 12-digit APAAR IDs and APAAR Secure Vault credentials
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenCreateStudentModal && (
            <button
              type="button"
              onClick={onOpenCreateStudentModal}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 ring-1 ring-emerald-400/40"
              title="Register a new student with automated APAAR ID and academic records"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Register New Student</span>
            </button>
          )}

          <div className="text-xs text-slate-400 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 shrink-0">
            Showing <strong className="text-amber-400 font-mono font-bold">{filteredStudents.length}</strong> of{' '}
            <span className="text-slate-300 font-mono">{totalCount}</span>
          </div>
        </div>
      </div>

      {/* Clean Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Registered */}
        <div
          onClick={() => {
            setSelectedIssue('All records');
            setSelectedStage('All stages');
          }}
          className="p-3.5 rounded-xl bg-[#111927] border border-slate-800/90 hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Total Enrolled</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-xl font-bold text-white font-mono mt-1">{totalCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">National student records</p>
        </div>

        {/* Active Enrolled */}
        <div
          onClick={() => {
            setSelectedIssue('All records');
            setSelectedStage('All stages');
          }}
          className="p-3.5 rounded-xl bg-[#111927] border border-slate-800/90 hover:border-emerald-500/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-emerald-400 text-[11px]">
            <span>Active Enrolled</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-xl font-bold text-emerald-400 font-mono mt-1">{activeCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Currently studying</p>
        </div>

        {/* Graduated */}
        <div
          onClick={() => {
            setSelectedStage('Graduated');
          }}
          className="p-3.5 rounded-xl bg-[#111927] border border-slate-800/90 hover:border-teal-500/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-teal-300 text-[11px]">
            <span>Graduated</span>
            <GraduationCap className="w-3.5 h-3.5 text-teal-300" />
          </div>
          <p className="text-xl font-bold text-teal-300 font-mono mt-1">{graduatedCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Degrees completed</p>
        </div>

        {/* Consent Pending */}
        <div
          onClick={() => {
            setSelectedIssue('Consent Pending');
          }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            selectedIssue === 'Consent Pending'
              ? 'bg-amber-500/10 border-amber-500/50'
              : 'bg-[#111927] border-slate-800/90 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 text-[11px]">
            <span>Consent Pending</span>
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400 font-mono mt-1">{consentPendingCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Awaiting statutory sign-off</p>
        </div>

        {/* Aadhaar Discrepancies */}
        <div
          onClick={() => {
            setSelectedIssue('Aadhaar Mismatch');
          }}
          className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
            selectedIssue === 'Aadhaar Mismatch'
              ? 'bg-rose-500/10 border-rose-500/50'
              : 'bg-[#111927] border-slate-800/90 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-rose-400 text-[11px]">
            <span>Aadhaar Mismatch</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-400 font-mono mt-1">{mismatchCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Requires demographic sync</p>
        </div>
      </div>


      {/* Filter Row matching screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        {/* Search Input */}
        <div className="md:col-span-5 relative space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="search-registry-input" className="block text-[11px] text-slate-400 font-semibold">
              Search by APAAR ID, Student Name, or Institution
            </label>
            {searchTerm && (
              <span className="text-[10px] text-amber-400 font-mono">
                {filteredStudents.length} match{filteredStudents.length === 1 ? '' : 'es'}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              id="search-registry-input"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setSearchTerm('');
              }}
              placeholder="e.g. 2990 9583 2586, Abinaya, or Govt Higher Secondary"
              className="w-full bg-[#111927] border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                title="Clear search"
                aria-label="Clear search input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick search suggestion chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] text-slate-400">
            <span>Try:</span>
            <button
              type="button"
              onClick={() => setSearchTerm('Abinaya')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Abinaya
            </button>
            <button
              type="button"
              onClick={() => setSearchTerm('2990 9583 2586')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 font-mono transition-colors"
            >
              2990 9583 2586
            </button>
            <button
              type="button"
              onClick={() => setSearchTerm('Attur')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Attur
            </button>
            <button
              type="button"
              onClick={() => setSearchTerm('Panchayat')}
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              Panchayat
            </button>
          </div>
        </div>

        {/* District Dropdown */}
        <div className="md:col-span-3">
          <label htmlFor="district-select" className="block text-[11px] text-slate-400 font-semibold mb-1">
            District
          </label>
          <select
            id="district-select"
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {districts.map(d => (
              <option key={d} value={d} className="bg-slate-900 text-white">
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Stage Dropdown */}
        <div className="md:col-span-2">
          <label htmlFor="stage-select" className="block text-[11px] text-slate-400 font-semibold mb-1">
            Stage
          </label>
          <select
            id="stage-select"
            value={selectedStage}
            onChange={e => setSelectedStage(e.target.value)}
            className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {stages.map(s => (
              <option key={s} value={s} className="bg-slate-900 text-white">
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Data Issue Dropdown */}
        <div className="md:col-span-2">
          <label htmlFor="issue-select" className="block text-[11px] text-slate-400 font-semibold mb-1">
            Data issue
          </label>
          <select
            id="issue-select"
            value={selectedIssue}
            onChange={e => setSelectedIssue(e.target.value)}
            className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {issues.map(iss => (
              <option key={iss} value={iss} className="bg-slate-900 text-white">
                {iss}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#111927] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f1725] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-4">APAAR ID</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Current Institution</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <p className="text-sm font-semibold text-slate-300">
                        {searchTerm
                          ? `No student records found matching "${searchTerm}"`
                          : 'No students match the selected stage and district filters.'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Try searching by 12-digit APAAR ID (e.g. 2990 9583 2586), student name, or institution name.
                      </p>
                      {(searchTerm || selectedDistrict !== 'All Districts' || selectedStage !== 'All Stages' || selectedIssue !== 'All Records') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedDistrict('All Districts');
                            setSelectedStage('All Stages');
                            setSelectedIssue('All Records');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-amber-400 border border-slate-700 transition-colors"
                        >
                          Reset all filters & search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.apaarId} className="hover:bg-slate-800/30 transition-colors">
                    {/* APAAR ID */}
                    <td className="py-3.5 px-4 font-mono font-medium text-amber-400/90 whitespace-nowrap">
                      {student.apaarId}
                    </td>

                    {/* Student Name & DOB */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{student.name}</span>
                        <span className="text-[11px] text-slate-400">{student.dob}</span>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="text-slate-200 font-medium">{student.stage}</span>
                        {student.gradeOrClass && (
                          <span className="text-[11px] text-slate-400">{student.gradeOrClass}</span>
                        )}
                      </div>
                    </td>

                    {/* Institution */}
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-300" title={student.currentInstitution}>
                      {student.currentInstitution}
                    </td>

                    {/* District */}
                    <td className="py-3.5 px-4 text-slate-300">{student.district}</td>

                    {/* Status & Badges matching image */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {student.status === 'Active' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        )}
                        {student.status === 'Graduated' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-950/60 text-teal-300 border border-teal-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            Graduated
                          </span>
                        )}
                        {student.status === 'Dropped out' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/60 text-rose-400 border border-rose-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Dropped out
                          </span>
                        )}
                        {student.aadhaarMismatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Mismatch
                          </span>
                        )}
                        {student.consentPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Consent
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {student.consentPending && onApproveStudentApaar && (
                          <button
                            onClick={() => onApproveStudentApaar(student)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors whitespace-nowrap flex items-center gap-1 shadow-sm"
                            title="Approve student statutory APAAR registration consent"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Approve APAAR</span>
                          </button>
                        )}
                        <button
                          onClick={() => onSelectStudentForVerification(student.apaarId)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900 border border-amber-800 rounded transition-colors whitespace-nowrap"
                          title="Initiate background verification check"
                        >
                          Verify Student
                        </button>
                        <button
                          onClick={() => onSelectStudentForConsent(student.apaarId)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
                          title="Open student dashboard view"
                        >
                          Consent View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
