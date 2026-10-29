/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Student } from '../types';
import { Search, ShieldCheck, CheckCircle2, FileText, ExternalLink, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

interface LookupViewProps {
  students: Student[];
  onSelectStudentForVerification: (apaarId: string) => void;
  onSelectStudentForConsent: (apaarId: string) => void;
}

export const LookupView: React.FC<LookupViewProps> = ({
  students,
  onSelectStudentForVerification,
  onSelectStudentForConsent,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<Student | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (overrideTerm?: string) => {
    const term = (overrideTerm !== undefined ? overrideTerm : searchInput).trim().toLowerCase();
    setHasSearched(true);
    if (!term) {
      setSearchedStudent(null);
      return;
    }

    const found = students.find(s => {
      const cleanTerm = term.replace(/\s+/g, '');
      const cleanApaar = s.apaarId.replace(/\s+/g, '').toLowerCase();
      return (
        cleanApaar === cleanTerm ||
        s.pen.toLowerCase() === cleanTerm ||
        s.name.toLowerCase().includes(term)
      );
    });

    setSearchedStudent(found || null);
  };

  const handleQuickChip = (term: string, isTypo = false) => {
    setSearchInput(term);
    if (isTypo) {
      setHasSearched(true);
      setSearchedStudent(null);
    } else {
      handleSearch(term);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      {/* Hero Section matching image_0a59ce87.png */}
      <div className="space-y-4 max-w-3xl">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          AUTOMATED PERMANENT ACADEMIC ACCOUNT REGISTRY
        </span>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          One 12-digit ID.{' '}
          <span className="text-amber-400">Every year of school and college.</span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Enter a student's APAAR ID to see their verified identity, full academic journey from Class 1 onward, Academic Bank of Credits balance and APAAR Secure Vault documents. You can also search by PEN or name.
        </p>
      </div>

      {/* Main Search Box */}
      <div className="space-y-3">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="APAAR ID, 11-digit PEN or name"
              className="w-full bg-[#111927] border border-slate-700/80 rounded-xl px-4 py-3.5 text-sm sm:text-base text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-400 shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm sm:text-base transition-colors shrink-0 shadow-md flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>Find student</span>
          </button>
        </form>

        {/* Try Chips matching screenshot */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
          <span>Try:</span>
          <button
            type="button"
            onClick={() => handleQuickChip('2990 9583 2586')}
            className="px-2.5 py-1 rounded bg-[#111927] hover:bg-slate-800 text-amber-300 border border-slate-800 font-mono"
          >
            2990 9583 2586 (Abinaya S)
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('8686 2578 1740')}
            className="px-2.5 py-1 rounded bg-[#111927] hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono"
          >
            8686 2578 1740
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('3988 1451 1988')}
            className="px-2.5 py-1 rounded bg-[#111927] hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono"
          >
            3988 1451 1988
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('8793 6328 9442')}
            className="px-2.5 py-1 rounded bg-[#111927] hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono"
          >
            8793 6328 9442
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('8813 7409 0183', true)}
            className="px-2.5 py-1 rounded bg-[#111927] hover:bg-slate-800 text-slate-400 border border-slate-800 font-mono"
          >
            8813 7409 0183 <span className="text-rose-400">(typo)</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('Ajay')}
            className="px-2.5 py-1 rounded bg-[#111927] hover:bg-slate-800 text-slate-300 border border-slate-800"
          >
            Ajay
          </button>
        </div>
      </div>

      {/* Search Result Card */}
      {hasSearched && (
        <div className="space-y-4">
          {searchedStudent ? (
            <div className="bg-[#111927] border border-amber-500/50 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">{searchedStudent.name}</h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                      {searchedStudent.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                    <span>DOB: {searchedStudent.dob}</span>
                    <span aria-hidden="true">·</span>
                    <span>Gender: {searchedStudent.gender}</span>
                    <span aria-hidden="true">·</span>
                    <span>District: {searchedStudent.district}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectStudentForVerification(searchedStudent.apaarId)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Initiate Employer BGV</span>
                  </button>

                  <button
                    onClick={() => onSelectStudentForConsent(searchedStudent.apaarId)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg text-xs transition-colors border border-slate-700"
                  >
                    <span>View Student Portal</span>
                  </button>
                </div>
              </div>

              {/* Identity & Registry stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 font-mono">
                  <span className="text-slate-400 block text-[11px]">APAAR ID</span>
                  <span className="text-amber-400 font-bold text-sm">{searchedStudent.apaarId}</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 font-mono">
                  <span className="text-slate-400 block text-[11px]">Permanent Edu No (PEN)</span>
                  <span className="text-slate-200 font-semibold">{searchedStudent.pen}</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Academic Bank Credits</span>
                  <span className="text-sky-400 font-bold font-mono text-sm">
                    {searchedStudent.abcCreditsBalance} Credits
                  </span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">APAAR Secure Vault</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">
                    {searchedStudent.digilockerDocumentsCount} Sealed Docs
                  </span>
                </div>
              </div>

              {/* Current Institution */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-1 text-xs">
                <span className="text-slate-400 font-medium block">Current Institution:</span>
                <p className="text-slate-200 font-semibold text-sm">{searchedStudent.currentInstitution}</p>
                <span className="text-[11px] text-amber-400 font-medium">Stage: {searchedStudent.stage}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#111927] border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No matching record found</h3>
              <p className="text-xs text-slate-400">
                Double-check the 12-digit APAAR ID or try searching with student name.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Note matching screenshot */}
      <div className="pt-12 text-center text-xs text-slate-500 border-t border-slate-800/80">
        Prototype for Smart India Hackathon problem 26263. Every student, number and record here is generated sample data. Changes you make are kept only in this browser.
      </div>
    </div>
  );
};
