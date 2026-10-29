/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SimulatedAlert, notificationService } from '../services/notificationService';
import {
  Bell,
  Smartphone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  Volume2,
  Lock,
  Building2,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface NotificationModalProps {
  currentAlert: SimulatedAlert | null;
  onClose: () => void;
  onGrantConsent: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onOpenStudentPortal: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  currentAlert,
  onClose,
  onGrantConsent,
  onRejectRequest,
  onOpenStudentPortal,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'EMAIL' | 'BROWSER_PUSH'>('SMS');
  const [browserPermission, setBrowserPermission] = useState<string>(() =>
    notificationService.getBrowserPermissionStatus()
  );
  const [permissionRequestedToast, setPermissionRequestedToast] = useState(false);

  if (!currentAlert) return null;

  const handleRequestNativePermission = async () => {
    const res = await notificationService.requestBrowserPermission();
    setBrowserPermission(res);
    setPermissionRequestedToast(true);
    setTimeout(() => setPermissionRequestedToast(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-amber-500/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Real-Time Verification Alert Simulator</h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded">
                  Live Dispatch
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Simulating instant SMS and Email notifications dispatched to {currentAlert.studentName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher for Channels */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => setSelectedChannel('SMS')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              selectedChannel === 'SMS'
                ? 'border-amber-400 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile SMS ({currentAlert.recipientPhone})</span>
          </button>

          <button
            onClick={() => setSelectedChannel('EMAIL')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              selectedChannel === 'EMAIL'
                ? 'border-amber-400 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Alert ({currentAlert.recipientEmail})</span>
          </button>

          <button
            onClick={() => setSelectedChannel('BROWSER_PUSH')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              selectedChannel === 'BROWSER_PUSH'
                ? 'border-amber-400 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Browser Web Notification</span>
          </button>
        </div>

        {/* Channel 1: Mobile SMS Simulation */}
        {selectedChannel === 'SMS' && (
          <div className="p-6 space-y-4">
            <div className="max-w-md mx-auto bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-inner space-y-4">
              {/* Phone Status Bar */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pb-2 border-b border-slate-800/60">
                <span>VK-APAAR-GOV</span>
                <span>Just Now</span>
                <span className="text-emerald-500 font-bold">● SMS Received</span>
              </div>

              {/* SMS Bubble */}
              <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 text-xs text-slate-200 space-y-3 shadow-md">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px]">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>APAAR DPDP Privacy Alert</span>
                </div>
                <p className="leading-relaxed font-sans text-xs">
                  {currentAlert.smsMessage}
                </p>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>To: {currentAlert.recipientPhone}</span>
                  <span className="text-emerald-400">Verified Gateway</span>
                </div>
              </div>

              {/* Direct In-SMS Quick Action */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] text-slate-400 text-center block">
                  Simulated 1-Tap Quick Action from SMS link:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onGrantConsent(currentAlert.requestId);
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve via SMS</span>
                  </button>

                  <button
                    onClick={() => {
                      onRejectRequest(currentAlert.requestId);
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Decline via SMS</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Channel 2: Email Alert Simulation */}
        {selectedChannel === 'EMAIL' && (
          <div className="p-6 space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-xs space-y-4">
              {/* Email Envelope Header */}
              <div className="space-y-1.5 pb-3 border-b border-slate-800 text-slate-400 text-[11px]">
                <div>
                  <strong className="text-slate-300">From: </strong>
                  <span>APAAR Registry &lt;no-reply@apaar.education.gov.in&gt;</span>
                </div>
                <div>
                  <strong className="text-slate-300">To: </strong>
                  <span>{currentAlert.studentName} &lt;{currentAlert.recipientEmail}&gt;</span>
                </div>
                <div>
                  <strong className="text-slate-300">Subject: </strong>
                  <span className="text-white font-medium">{currentAlert.emailSubject}</span>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800/80 space-y-3 text-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                    A
                  </div>
                  <strong className="text-sm text-white">APAAR Portal (Prototype)</strong>
                </div>

                <pre className="font-sans whitespace-pre-line text-xs text-slate-300 leading-relaxed">
                  {currentAlert.emailHtml}
                </pre>
              </div>

              {/* Direct Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    onRejectRequest(currentAlert.requestId);
                    onClose();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Decline Verification
                </button>

                <button
                  onClick={() => {
                    onGrantConsent(currentAlert.requestId);
                    onClose();
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Grant Verification Consent</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Channel 3: Browser Web Notification API */}
        {selectedChannel === 'BROWSER_PUSH' && (
          <div className="p-6 space-y-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Native Browser Notification Status</h4>
                  <p className="text-slate-400 text-xs">
                    Uses the browser's standard <code className="text-amber-400 font-mono">window.Notification</code> API.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full font-mono text-xs font-semibold bg-slate-800 text-amber-400 border border-slate-700">
                  Permission: {browserPermission}
                </span>
              </div>

              {permissionRequestedToast && (
                <div className="p-3 bg-slate-900 border border-amber-500/50 rounded text-amber-300 text-xs">
                  Native Notification API was invoked. Note: In sandboxed iframes or automated test browsers, notifications may be automatically managed.
                </div>
              )}

              <p className="text-slate-300 leading-relaxed">
                When granted, the system sends an operating system-level desktop notification to the student whenever an employer initiates a background check.
              </p>

              <div className="p-4 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>APAAR BGV Request: {currentAlert.employerName}</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {currentAlert.employerName} requested access to your {currentAlert.requestedCredentials.join(', ')}. Action required to grant or deny consent under DPDP Act.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRequestNativePermission}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold flex items-center gap-2 border border-slate-700"
              >
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Request / Test Browser Notification Permission</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Bar */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenStudentPortal();
            }}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            <span>Open Student Consent Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
          >
            Dismiss Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
