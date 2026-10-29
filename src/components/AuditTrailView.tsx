/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditLogEntry } from '../types';
import { ShieldCheck, History, Download, Search, CheckCircle2, AlertTriangle, Info, Lock } from 'lucide-react';

interface AuditTrailViewProps {
  logs: AuditLogEntry[];
  initialFilterRequestId?: string;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs, initialFilterRequestId }) => {
  const [searchTerm, setSearchTerm] = useState(initialFilterRequestId || '');
  const [selectedActorType, setSelectedActorType] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchesReq = log.requestId?.toLowerCase().includes(q);
      const matchesApaar = log.studentApaarId.toLowerCase().includes(q);
      const matchesActor = log.actor.toLowerCase().includes(q);
      const matchesDetails = log.details.toLowerCase().includes(q);
      if (!matchesReq && !matchesApaar && !matchesActor && !matchesDetails) return false;
    }

    if (selectedActorType !== 'ALL' && log.actorType !== selectedActorType) return false;
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;

    return true;
  });

  const exportAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `apaar-bgv-audit-trail-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-amber-400" />
            Immutable Verification Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident cryptographic ledger recording every employer background check, student consent decision, and AICTE / APAAR Secure Vault verification query.
          </p>
        </div>

        <button
          onClick={exportAsJson}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-slate-700 shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Export Audit Log (JSON)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        <div className="md:col-span-6">
          <label htmlFor="search-audit-input" className="block text-[11px] text-slate-400 font-semibold mb-1">
            Search Ledger
          </label>
          <div className="relative">
            <input
              id="search-audit-input"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Request ID, APAAR ID, Employer or Verifier..."
              className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="actor-filter-select" className="block text-[11px] text-slate-400 font-semibold mb-1">
            Actor Origin
          </label>
          <select
            id="actor-filter-select"
            value={selectedActorType}
            onChange={e => setSelectedActorType(e.target.value)}
            className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">All Actors</option>
            <option value="EMPLOYER">Employer Entity</option>
            <option value="STUDENT">Student Candidate</option>
            <option value="AICTE_GATEWAY">AICTE Repository</option>
            <option value="SYSTEM">System & PKI Engine</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="level-filter-select" className="block text-[11px] text-slate-400 font-semibold mb-1">
            Event Severity
          </label>
          <select
            id="level-filter-select"
            value={selectedLevel}
            onChange={e => setSelectedLevel(e.target.value)}
            className="w-full bg-[#111927] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="SUCCESS">Success / Verified</option>
            <option value="ALERT">Alert / Revocation / Tamper</option>
            <option value="INFO">Informational</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#111927] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f1725] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Actor & Origin</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Candidate APAAR</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4 font-mono">SHA-256 Fingerprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      <div>
                        {new Date(log.timestamp).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4 font-medium max-w-xs truncate text-white" title={log.actor}>
                      <span className="block truncate">{log.actor}</span>
                      <span className="text-[10px] font-mono text-slate-400">{log.actorType}</span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {log.level === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          {log.action}
                        </span>
                      )}
                      {log.level === 'ALERT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">
                          <AlertTriangle className="w-3 h-3" />
                          {log.action}
                        </span>
                      )}
                      {log.level === 'INFO' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          <Info className="w-3 h-3" />
                          {log.action}
                        </span>
                      )}
                    </td>

                    {/* APAAR ID */}
                    <td className="py-3.5 px-4 font-mono text-amber-400/90 whitespace-nowrap">
                      {log.studentApaarId}
                    </td>

                    {/* Details */}
                    <td className="py-3.5 px-4 max-w-md text-slate-300 leading-relaxed" title={log.details}>
                      {log.details}
                      {log.requestId && (
                        <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                          Req ID: #{log.requestId}
                        </span>
                      )}
                    </td>

                    {/* SHA256 Fingerprint */}
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap" title={log.sha256Fingerprint}>
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-600 shrink-0" />
                        <span>{log.sha256Fingerprint.slice(0, 16)}...</span>
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
