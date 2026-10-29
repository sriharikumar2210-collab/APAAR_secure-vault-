/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Student, AcademicCredential } from '../types';
import {
  parseApaarQrPayload,
  resolveStudentFromQr,
  generateApaarQrPayload,
} from '../utils/qrScanner';
import {
  QrCode,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Building2,
  GraduationCap,
  ArrowRight,
  RefreshCw,
  Zap,
  Info,
} from 'lucide-react';

interface ApaarQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onScanSuccess: (params: {
    student: Student;
    autoTriggered: boolean;
    requestId?: string;
  }) => void;
  onSubmitRequest: (params: {
    employerName: string;
    verifierName: string;
    verifierEmail: string;
    studentApaarId: string;
    requestedCredentials: AcademicCredential['type'][];
    purpose: string;
  }) => { success: boolean; error?: string; requestId?: string };
  defaultEmployerName?: string;
  defaultVerifierName?: string;
  defaultVerifierEmail?: string;
  defaultRequestedCredentials?: AcademicCredential['type'][];
  defaultPurpose?: string;
}

export const ApaarQrScannerModal: React.FC<ApaarQrScannerModalProps> = ({
  isOpen,
  onClose,
  students,
  onScanSuccess,
  onSubmitRequest,
  defaultEmployerName = 'Tata Consultancy Services',
  defaultVerifierName = 'Kavitha Ramachandran',
  defaultVerifierEmail = 'kavitha.demo@tcs.example.com',
  defaultRequestedCredentials = ['DEGREE', 'MARKSHEET', 'AICTE_APPROVAL'],
  defaultPurpose = 'Pre-Employment Background Verification for Systems Engineer',
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'cards' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoTrigger, setAutoTrigger] = useState<boolean>(true);
  const [selectedCreds, setSelectedCreds] = useState<AcademicCredential['type'][]>(
    defaultRequestedCredentials
  );

  // Scan result state
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [dispatchedRequestId, setDispatchedRequestId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Play scanner confirmation beep using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio playback failed or blocked by policy
    }
  };

  // Camera initialization
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to access camera. Please check permissions.';
      setCameraError(
        message.includes('Permission') || message.includes('denied')
          ? 'Camera permission denied or camera device in use. You can use the Physical Card Deck or Upload an APAAR card image below.'
          : 'WebCam stream unavailable in this sandbox. Use the interactive Physical Card Deck or Image Upload to test scanning.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      setScannedStudent(null);
      setDispatchedRequestId(null);
      setScanMessage(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Execute verification request for the scanned student
  const handleProcessScan = (student: Student) => {
    playBeep();
    setScannedStudent(student);

    if (autoTrigger) {
      setIsProcessing(true);
      setScanMessage('Dispatching statutory verification request to candidate...');

      setTimeout(() => {
        const result = onSubmitRequest({
          employerName: defaultEmployerName,
          verifierName: defaultVerifierName,
          verifierEmail: defaultVerifierEmail,
          studentApaarId: student.apaarId,
          requestedCredentials: selectedCreds,
          purpose: defaultPurpose,
        });

        setIsProcessing(false);
        if (result.success && result.requestId) {
          setDispatchedRequestId(result.requestId);
          setScanMessage(
            `Background verification request #${result.requestId} initiated successfully. Candidate notified via SMS and email.`
          );
          onScanSuccess({
            student,
            autoTriggered: true,
            requestId: result.requestId,
          });
        } else {
          setScanMessage(result.error || 'Failed to submit verification request.');
        }
      }, 350);
    } else {
      setScanMessage('Card detected! Click "Submit Verification Request" below to proceed.');
      onScanSuccess({
        student,
        autoTriggered: false,
      });
    }
  };

  // Process raw payload string (from file upload, manual input, or sample card)
  const handleRawPayloadScan = (rawPayload: string) => {
    const resolveResult = resolveStudentFromQr(rawPayload, students);
    if (resolveResult.success && resolveResult.student) {
      handleProcessScan(resolveResult.student);
    } else {
      const parsed = parseApaarQrPayload(rawPayload);
      if (parsed.success && parsed.data) {
        setScanMessage(
          `Scanned valid APAAR ID (${parsed.data.apaarId}), but student is not enrolled in this mock instance.`
        );
      } else {
        setScanMessage(resolveResult.error || 'Invalid APAAR QR code format.');
      }
    }
  };

  // Image file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate OCR / QR decoding from image
    setIsProcessing(true);
    setScanMessage(`Analyzing ${file.name} for APAAR QR matrix...`);

    setTimeout(() => {
      setIsProcessing(false);
      // Auto-match student: Pick first graduated student or default Abinaya S for uploaded card demo
      const matched = students.find(s => s.apaarId === '2990 9583 2586') || students[0];
      if (matched) {
        const payload = generateApaarQrPayload(matched);
        handleRawPayloadScan(payload);
      }
    }, 700);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleRawPayloadScan(manualInput.trim());
  };

  const handleToggleCred = (cred: AcademicCredential['type']) => {
    setSelectedCreds(prev =>
      prev.includes(cred)
        ? prev.length > 1
          ? prev.filter(c => c !== cred)
          : prev
        : [...prev, cred]
    );
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Tricolor top accent strip matching official Indian Gov aesthetic */}
        <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-emerald-600" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  NEP 2020 · One Nation One Student ID
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                  Live Scanner
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5">
                Physical APAAR ID Card Scanner & Instant BGV
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title={soundEnabled ? 'Mute scanner chime' : 'Enable scanner chime'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera Viewfinder</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                activeTab === 'cards'
                  ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Physical Card Deck (Demo)</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-mono">
                Instant
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-amber-400 text-amber-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Card Image</span>
            </button>
          </div>

          {/* Auto-Trigger Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoTrigger}
              onChange={e => setAutoTrigger(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-dispatch BGV on scan</span>
            </span>
          </label>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: Live Camera Viewfinder */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="relative aspect-video max-h-72 w-full mx-auto bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700 flex flex-col items-center justify-center shadow-inner">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <Camera className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300">
                        {cameraError ? 'WebCam Inactive in Sandbox' : 'Initializing Camera...'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        {cameraError ||
                          'Aim your device camera at the QR code on the student\'s laminated APAAR card.'}
                      </p>
                    </div>
                    {cameraError && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('cards')}
                          className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow transition-colors flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Scan From Physical Card Deck</span>
                        </button>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Camera</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Laser Scanning Overlay Animation */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Targeting Reticle Frame */}
                  <div className="relative w-48 h-48 border-2 border-amber-400/60 rounded-xl bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400" />

                    {/* Laser scanning line sweeping vertically */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce duration-1000 top-1/2" />

                    {/* Center reticle */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <div className="w-8 h-8 border border-dashed border-amber-400 rounded-full" />
                    </div>
                  </div>

                  {/* Status caption */}
                  <div className="absolute bottom-3 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-full text-[11px] font-mono text-amber-400/90 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Optical QR Frame Active · Align Code Inside Square</span>
                  </div>
                </div>
              </div>

              {/* Quick shortcut to test with sample cards below camera */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    No physical card in front of your camera right now? Click any candidate card below to simulate an instant optical scan:
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {students.slice(0, 3).map(student => (
                    <button
                      key={student.apaarId}
                      type="button"
                      onClick={() => handleRawPayloadScan(generateApaarQrPayload(student))}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg transition-colors"
                    >
                      {student.name.split(' ')[0]} ({student.apaarId.slice(-4)})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Physical APAAR Card Deck (High-Fidelity Sample Cards) */}
          {activeTab === 'cards' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Physical APAAR ID Cards (Click to Scan)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Official biometric & QR-embedded PVC cards issued under NEP 2020 by the Ministry of Education.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {students.length} Cards in Registry
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.map(student => {
                  const qrPayload = generateApaarQrPayload(student);
                  const isSelected = scannedStudent?.apaarId === student.apaarId;

                  return (
                    <div
                      key={student.apaarId}
                      className={`relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 rounded-xl p-4 shadow-lg transition-all duration-150 flex flex-col justify-between overflow-hidden group ${
                        isSelected
                          ? 'border-emerald-500 shadow-emerald-950/40'
                          : 'border-slate-800 hover:border-amber-500/60'
                      }`}
                    >
                      {/* Tricolor top header on physical card */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-emerald-600" />

                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-400">
                            IN
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block leading-tight">
                              Sample card · Prototype
                            </span>
                            <span className="text-[11px] font-bold text-white block leading-tight">
                              APAAR / Automated Student ID
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                          {student.stage}
                        </span>
                      </div>

                      {/* Card Content (Candidate info + QR matrix) */}
                      <div className="py-3 flex items-center gap-4">
                        {/* Student Avatar */}
                        <div className="w-12 h-14 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-amber-400 font-bold text-lg shrink-0 shadow-inner">
                          <span>{student.name.charAt(0)}</span>
                          <span className="text-[8px] font-mono text-slate-400 uppercase mt-0.5">
                            {student.gender.charAt(0)}
                          </span>
                        </div>

                        {/* Student Info */}
                        <div className="flex-1 min-w-0 space-y-0.5 text-xs">
                          <h4 className="text-sm font-bold text-white truncate">{student.name}</h4>
                          <p className="text-[11px] text-slate-400 truncate">
                            {student.currentInstitution}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                            <span>DOB: {student.dob}</span>
                            <span>PEN: {student.pen}</span>
                          </div>
                        </div>

                        {/* Realistic QR Matrix Square */}
                        <div className="relative w-16 h-16 bg-white p-1 rounded-md shrink-0 shadow flex flex-col items-center justify-center border border-slate-300">
                          {/* Simulated high-contrast QR Matrix */}
                          <div className="w-full h-full bg-slate-900 rounded-[2px] p-0.5 flex flex-col justify-between">
                            <div className="flex justify-between">
                              <div className="w-3.5 h-3.5 border-2 border-white flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white" />
                              </div>
                              <div className="w-3.5 h-3.5 border-2 border-white flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white" />
                              </div>
                            </div>
                            <div className="flex items-center justify-center">
                              <div className="w-2.5 h-2.5 bg-amber-400 rounded-sm" />
                            </div>
                            <div className="flex justify-between">
                              <div className="w-3.5 h-3.5 border-2 border-white flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white" />
                              </div>
                              <div className="w-2 h-2 bg-white" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: APAAR Number & Scan Action */}
                      <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 block">
                            APAAR ID Number
                          </span>
                          <span className="font-mono text-xs font-bold text-amber-400 tracking-wider">
                            {student.apaarId}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRawPayloadScan(qrPayload)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                              : 'bg-amber-500 text-slate-950 hover:bg-amber-400 group-hover:scale-105'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Re-scan Card' : 'Scan Card QR'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Upload Image */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl p-8 text-center bg-slate-900/40 hover:bg-slate-900/70 cursor-pointer transition-colors space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-amber-400 border border-slate-700">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Drop candidate's APAAR card photo here, or browse
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Accepts PNG, JPG, WebP, or PDF exports of the student's physical card or APAAR Secure Vault QR code.
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-slate-200 rounded-lg border border-slate-700 hover:bg-slate-700"
                >
                  Select File from Computer
                </button>
              </div>

              {/* Direct Payload / Barcode string input */}
              <form onSubmit={handleManualSubmit} className="space-y-2 pt-2">
                <label htmlFor="raw-payload-input" className="text-xs text-slate-400 block font-medium">
                  Or paste raw QR verification URI / 12-digit APAAR string:
                </label>
                <div className="flex gap-2">
                  <input
                    id="raw-payload-input"
                    type="text"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder="e.g. https://apaar.education.gov.in/verify?id=299095832586 or 2990 9583 2586"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Decode</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Verification Credentials Request Configuration */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Target Credentials to Request for Scanned Candidate
              </span>
              <span className="text-[11px] text-slate-400">
                Employer: <strong className="text-slate-200">{defaultEmployerName}</strong>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  { type: 'DEGREE', label: 'Degree Certificate' },
                  { type: 'MARKSHEET', label: 'Consolidated Marksheet' },
                  { type: 'AICTE_APPROVAL', label: 'AICTE Approval Seal' },
                  { type: 'ABC_TRANSCRIPT', label: 'ABC Credit Transcript' },
                ] as { type: AcademicCredential['type']; label: string }[]
              ).map(item => {
                const isChecked = selectedCreds.includes(item.type);
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleToggleCred(item.type)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                      isChecked
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scanner Feedback / Success Screen */}
          {scanMessage && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                dispatchedRequestId
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                  : scannedStudent
                  ? 'bg-amber-950/70 border-amber-700 text-amber-200'
                  : 'bg-rose-950/70 border-rose-800 text-rose-300'
              }`}
            >
              {dispatchedRequestId ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-sm">
                  {dispatchedRequestId
                    ? 'Background Verification Request Dispatched!'
                    : scannedStudent
                    ? 'Student Card Recognized'
                    : 'Notice'}
                </div>
                <p className="text-xs leading-relaxed">{scanMessage}</p>
                {scannedStudent && (
                  <div className="mt-2 pt-2 border-t border-current/20 flex flex-wrap items-center gap-4 text-[11px] font-mono">
                    <span>
                      Name: <strong>{scannedStudent.name}</strong>
                    </span>
                    <span>
                      APAAR ID: <strong>{scannedStudent.apaarId}</strong>
                    </span>
                    <span>
                      Institution: <strong>{scannedStudent.currentInstitution}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scanned Student Confirmation if Auto-Trigger was OFF */}
          {scannedStudent && !dispatchedRequestId && !autoTrigger && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScannedStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
              >
                Scan Different Card
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleProcessScan(scannedStudent)}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-lg flex items-center gap-1.5"
              >
                <span>Dispatch BGV Request</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>
              Compliant with <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {dispatchedRequestId && (
              <button
                type="button"
                onClick={() => {
                  setScannedStudent(null);
                  setDispatchedRequestId(null);
                  setScanMessage(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
              >
                Scan Another Card
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow transition-colors"
            >
              Done & Return to Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
