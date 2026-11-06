/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Student,
  VerificationRequest,
  StudentConsentPreferences,
  AuditLogEntry,
  AcademicCredential,
} from './types';
import {
  generateFullStudentRegistry,
  INITIAL_STUDENT_PREFERENCES,
  INITIAL_VERIFICATION_REQUESTS,
  INITIAL_AUDIT_LOGS,
} from './data/mockData';
import {
  checkAutoApproval,
  createAuditLog,
  verifyDigitalSignature,
} from './utils/verificationEngine';
import { notificationService, SimulatedAlert } from './services/notificationService';
import { realtimeClient, SyncResult } from './services/realtimeClient';
import { restoreSession, signOutLocally, loginWithDemoAccount } from './services/authApi';
import { Navbar, ActiveTab } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal';
import { EmployerPortal } from './components/EmployerPortal';
import { RegistryView } from './components/RegistryView';
import { LookupView } from './components/LookupView';
import { InsightsView } from './components/InsightsView';
import { AuditTrailView } from './components/AuditTrailView';
import { CertificateModal } from './components/CertificateModal';
import { NotificationModal } from './components/NotificationModal';
import { DocumentVerificationView } from './components/DocumentVerificationView';
import { ApaarApprovalModal, ApprovalMode, ApprovalMethod } from './components/ApaarApprovalModal';
import { CreateStudentModal } from './components/CreateStudentModal';
import { CreateAccountModal } from './components/CreateAccountModal';
import { ApaarGuideModal } from './components/ApaarGuideModal';
import { LoginPage } from './components/LoginPage';
import { PrototypeBanner } from './components/PrototypeBanner';
import { SovereignCommandDeck } from './components/SovereignCommandDeck';
import { UserAccount } from './types/auth';
import {
  loadUserAccounts,
  persistUserAccounts,
  loadActiveUser,
  persistActiveUserId,
  loadStoredSessionToken,
} from './utils/authEngine';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  db,
  collection,
  query,
  where,
  onSnapshot,
  handleFirestoreError,
  OperationType,
  syncUserProfileToFirestore,
  recordFirestoreSessionLog,
} from './lib/firebase';
import {
  Bell,
  Smartphone,
  Mail,
  X,
  KeyRound,
  UserPlus,
  Sparkles,
  HelpCircle,
  Building2,
  GraduationCap,
  Briefcase,
  ShieldAlert,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('employer-bgv');
  const [accounts, setAccounts] = useState<UserAccount[]>(() => loadUserAccounts());
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => loadActiveUser(accounts));
  // Signed-in state comes from the server (GET /api/auth/me), never from a browser flag.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => !!loadStoredSessionToken());
  const [loginPrefillEmail, setLoginPrefillEmail] = useState<string | undefined>(undefined);
  const [serverNotice, setServerNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>(() => {
    const defaultRegistry = generateFullStudentRegistry();
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('apaar_created_students_v1');
        if (stored) {
          const parsed: Student[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Filter out duplicates by apaarId
            const existingIds = new Set(defaultRegistry.map(s => s.apaarId));
            const newOnes = parsed.filter(p => !existingIds.has(p.apaarId));
            return [...newOnes, ...defaultRegistry];
          }
        }
      } catch (e) {
        console.warn('Could not hydrate stored students', e);
      }
    }
    return defaultRegistry;
  });
  const [activeStudentApaarId, setActiveStudentApaarId] = useState<string>('2990 9583 2586');
  const [requests, setRequests] = useState<VerificationRequest[]>(INITIAL_VERIFICATION_REQUESTS);
  const [preferences, setPreferences] = useState<Record<string, StudentConsentPreferences>>(
    INITIAL_STUDENT_PREFERENCES
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [selectedCredentialForModal, setSelectedCredentialForModal] =
    useState<AcademicCredential | null>(null);
  const [auditFilterRequestId, setAuditFilterRequestId] = useState<string | undefined>(undefined);
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);


  // APAAR Approval Options Modal state
  const [approvalModalState, setApprovalModalState] = useState<{
    isOpen: boolean;
    mode: ApprovalMode;
    request?: VerificationRequest;
    student?: Student;
  } | null>(null);

  // Real-time notification service state
  const [activeAlertModal, setActiveAlertModal] = useState<SimulatedAlert | null>(null);
  const [toastAlert, setToastAlert] = useState<SimulatedAlert | null>(null);
  const [alertHistory, setAlertHistory] = useState<SimulatedAlert[]>([]);

  // Restore a previous session if valid token exists; otherwise show Login Page immediately
  useEffect(() => {
    const token = loadStoredSessionToken();
    const manualSignOut =
      typeof window !== 'undefined' && sessionStorage.getItem('apaar_manual_signout') === '1';

    if (token && !manualSignOut) {
      restoreSession().then(user => {
        if (user) {
          setCurrentUser(user);
          routeToRoleWorkspace(user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
        setIsRestoringSession(false);
      });
    } else {
      setIsRestoringSession(false);
      setIsAuthenticated(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a short notice when the server refuses or cannot record an action.
  // If the server refused (not just offline), undo the change on screen.
  const reportSync = (result: SyncResult, action: string, undo?: () => void) => {
    if (result.ok) return;
    if (undo && result.status !== 0 && result.status !== 503) undo();
    if (result.status === 0 || result.status === 503) {
      setServerNotice({ tone: 'info', text: `Server offline: "${action}" is only shown in this browser and was not saved.` });
    } else {
      setServerNotice({ tone: 'error', text: `Server refused "${action}": ${result.error}` });
    }
  };

  // Subscribe to Firebase Auth & Firestore user-scoped sessionLogs when signed in with Google SSO
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, fbUser => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (fbUser && fbUser.emailVerified) {
        const logsQuery = query(
          collection(db, 'sessionLogs'),
          where('ownerId', '==', fbUser.uid)
        );
        unsubscribeSnapshot = onSnapshot(
          logsQuery,
          snapshot => {
            if (!snapshot.empty) {
              // Merge user-owned Firestore session logs into local audit state if not already present
              setAuditLogs(prev => {
                const existingIds = new Set(prev.map(l => l.id));
                const added: AuditLogEntry[] = [];
                snapshot.forEach(docSnap => {
                  if (!existingIds.has(docSnap.id)) {
                    const data = docSnap.data();
                    const entry = createAuditLog(
                      String(data.actor || 'Firebase Auth Operator'),
                      'SYSTEM',
                      'PREFERENCES_UPDATED',
                      String(data.targetApaarId || 'AUTH_GATEWAY'),
                      String(data.details || 'Verified session event'),
                      data.status === 'ALERT' || data.status === 'INFO'
                        ? data.status
                        : 'SUCCESS'
                    );
                    added.push({
                      ...entry,
                      id: docSnap.id,
                    });
                  }
                });
                return added.length > 0 ? [...added, ...prev] : prev;
              });
            }
          },
          error => {
            handleFirestoreError(error, OperationType.LIST, 'sessionLogs');
          }
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Subscribe to notification service & real-time Cloud SQL engine on mount
  useEffect(() => {
    // Generate initial alert for the default pending request (TCS -> Abinaya S)
    const initialAlert = notificationService.dispatchVerificationAlert({
      requestId: 'BGV-2026-9041',
      studentName: 'Abinaya S',
      studentApaarId: '2990 9583 2586',
      recipientPhone: '+91 90000 00002',
      recipientEmail: 'abinaya.attur@student.example.edu.in',
      employerName: 'Tata Consultancy Services',
      requestedCredentials: ['DEGREE', 'MARKSHEET', 'AICTE_APPROVAL'],
      purpose: 'Pre-Employment Background Verification for Systems Engineer',
    });

    setAlertHistory([initialAlert]);

    const unsubscribeNotifications = notificationService.subscribe(alert => {
      setToastAlert(alert);
      setAlertHistory(notificationService.getHistory());
    });

    return () => {
      unsubscribeNotifications();
    };
  }, []);

  // After sign-in: load what this user may see from the server and open the live-update channel
  useEffect(() => {
    if (!isAuthenticated) return;

    realtimeClient.fetchInitialState().then(dbState => {
      if (!dbState) return;
      if (Array.isArray(dbState.students) && dbState.students.length > 0) {
        setStudents(prev => {
          const prevMap = new Map<string, Student>(prev.map(p => [p.apaarId, p]));
          const byId = new Map<string, Student>();
          for (const s of dbState.students) {
            const existing = prevMap.get(s.apaarId);
            byId.set(s.apaarId, {
              ...existing,
              ...s,
              credentials:
                Array.isArray(s.credentials) && s.credentials.length > 0
                  ? s.credentials
                  : existing?.credentials || [],
            });
          }
          for (const s of prev) {
            if (!byId.has(s.apaarId)) byId.set(s.apaarId, s);
          }
          return Array.from(byId.values());
        });
      }
      if (Array.isArray(dbState.requests) && dbState.requests.length > 0) {
        setRequests(prev => {
          const byId = new Map<string, VerificationRequest>();
          for (const r of dbState.requests) byId.set(r.id, r);
          for (const r of prev) {
            if (!byId.has(r.id)) byId.set(r.id, r);
          }
          return Array.from(byId.values());
        });
      }
      if (Array.isArray(dbState.auditLogs) && dbState.auditLogs.length > 0) {
        setAuditLogs(prev => {
          const byId = new Map<string, AuditLogEntry>();
          for (const l of dbState.auditLogs) byId.set(l.id, l);
          for (const l of prev) {
            if (!byId.has(l.id)) byId.set(l.id, l);
          }
          return Array.from(byId.values());
        });
      }
      if (Array.isArray(dbState.users) && dbState.users.length > 0) {
        setAccounts(prev => {
          const byId = new Map<string, UserAccount>();
          for (const u of dbState.users) byId.set(u.id, u);
          for (const u of prev) {
            if (!byId.has(u.id)) byId.set(u.id, u);
          }
          const merged = Array.from(byId.values());
          persistUserAccounts(merged);
          return merged;
        });
        const refreshedSelf = dbState.users.find((u: any) => u.id === currentUser.id);
        if (refreshedSelf) {
          setCurrentUser(prev => ({ ...prev, ...refreshedSelf }));
        }
      }
    });

    const disconnectRealtime = realtimeClient.connect();
    const unsubscribeRealtime = realtimeClient.subscribe(event => {
      if (event.type === 'student:upserted' && event.payload?.apaarId) {
        const incoming: Student = event.payload;
        setStudents(prev => {
          const exists = prev.some(s => s.apaarId === incoming.apaarId);
          return exists
            ? prev.map(s => (s.apaarId === incoming.apaarId ? incoming : s))
            : [incoming, ...prev];
        });
      } else if (event.type === 'request:upserted' && event.payload?.id) {
        const incoming: VerificationRequest = event.payload;
        setRequests(prev => {
          const exists = prev.some(r => r.id === incoming.id);
          return exists
            ? prev.map(r => (r.id === incoming.id ? { ...r, ...incoming } : r))
            : [incoming, ...prev];
        });
      } else if (event.type === 'audit:created' && event.payload?.id) {
        const incoming: AuditLogEntry = event.payload;
        setAuditLogs(prev => {
          if (prev.some(l => l.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });
      } else if (event.type === 'user:synced' && event.payload?.id) {
        const incoming: UserAccount = event.payload;
        setAccounts(prev => {
          const exists = prev.some(a => a.id === incoming.id);
          const next = exists ? prev.map(a => (a.id === incoming.id ? { ...a, ...incoming } : a)) : [incoming, ...prev];
          persistUserAccounts(next);
          return next;
        });
        setCurrentUser(prev => (prev.id === incoming.id ? { ...prev, ...incoming } : prev));
      }
    });

    return () => {
      unsubscribeRealtime();
      disconnectRealtime();
    };
  }, [isAuthenticated]);

  // Active student object
  const currentStudent =
    students.find(s => s.apaarId === activeStudentApaarId) || students[2] || students[0];

  // Current student preferences
  const currentPrefs: StudentConsentPreferences = preferences[activeStudentApaarId] || {
    autoApproveVettedEmployers: false,
    notifyViaSMS: true,
    notifyViaEmail: true,
    requireOtpForApproval: true,
    defaultValidityHours: 24,
    blacklistedEmployers: [],
    allowedCredentials: ['DEGREE', 'MARKSHEET', 'AICTE_APPROVAL', 'ABC_TRANSCRIPT'],
    dataPrivacyVersion: 'DPDP Act 2023 / Section 6',
  };

  // Pending count for the current student
  const studentPendingCount = requests.filter(
    r => r.studentApaarId === currentStudent.apaarId && r.status === 'PENDING_STUDENT_CONSENT'
  ).length;

  // Handler: Employer initiates verification request
  const handleSubmitRequest = (params: {
    employerName: string;
    verifierName: string;
    verifierEmail: string;
    studentApaarId: string;
    requestedCredentials: AcademicCredential['type'][];
    purpose: string;
  }) => {
    const student = students.find(
      s => s.apaarId.replace(/\s+/g, '') === params.studentApaarId.replace(/\s+/g, '')
    );

    if (!student) {
      return { success: false, error: 'Student with this APAAR ID was not found in the national registry.' };
    }

    const studentPrefs = preferences[student.apaarId] || currentPrefs;

    // Check blacklist
    if (studentPrefs.blacklistedEmployers.some(e => e.toLowerCase() === params.employerName.toLowerCase())) {
      return {
        success: false,
        error: `Request blocked by student privacy rules: ${params.employerName} is in candidate's blacklist.`,
      };
    }

    const newReqId = `BGV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + (studentPrefs.defaultValidityHours || 24) * 3600 * 1000).toISOString();

    // Check auto approval
    const isAutoApproved = checkAutoApproval(params.employerName, params.requestedCredentials[0], studentPrefs);

    const newRequest: VerificationRequest = {
      id: newReqId,
      employerId: `EMP-${Date.now().toString(36).toUpperCase()}`,
      employerName: params.employerName,
      verifierName: params.verifierName,
      verifierRole: 'Talent Acquisition & Compliance Officer',
      verifierEmail: params.verifierEmail,
      verifierIp: '49.207.' + Math.floor(100 + Math.random() * 80) + '.' + Math.floor(10 + Math.random() * 80),
      studentApaarId: student.apaarId,
      studentName: student.name,
      requestedCredentialTypes: params.requestedCredentials,
      purpose: params.purpose,
      requestedAt: nowIso,
      consentExpiresAt: expiryIso,
      status: isAutoApproved ? 'CONSENT_GRANTED' : 'PENDING_STUDENT_CONSENT',
      consentGrantedAt: isAutoApproved ? nowIso : undefined,
      scopeOfAccess: ['IDENTITY', 'ACADEMIC_MARKS', 'DIGITAL_SIGNATURE'],
      auditTrailId: `AUDIT-${newReqId}`,
    };

    setRequests(prev => [newRequest, ...prev]);

    // Audit logs
    const log1 = createAuditLog(
      `${params.employerName} (${params.verifierName} - IP: ${newRequest.verifierIp})`,
      'EMPLOYER',
      'REQUEST_INITIATED',
      student.apaarId,
      `Submitted background check request #${newReqId} for [${params.requestedCredentials.join(', ')}]. Purpose: ${params.purpose}`,
      'INFO',
      newReqId
    );

    const log2 = createAuditLog(
      'APAAR Consent Notification Service',
      'SYSTEM',
      'NOTIFICATION_DELIVERED',
      student.apaarId,
      `Encrypted consent prompt sent to student portal & mobile (+91 ${student.contactPhone}). Status: ${isAutoApproved ? 'AUTO_APPROVED_BY_POLICY' : 'PENDING_STUDENT_CONSENT'}`,
      isAutoApproved ? 'SUCCESS' : 'INFO',
      newReqId
    );

    setAuditLogs(prev => [log2, log1, ...prev]);

    // Dispatch real-time SMS / Email / Browser Notification through service layer
    const alertPayload = {
      requestId: newReqId,
      studentName: student.name,
      studentApaarId: student.apaarId,
      recipientPhone: student.contactPhone,
      recipientEmail: student.contactEmail,
      employerName: params.employerName,
      requestedCredentials: params.requestedCredentials,
      purpose: params.purpose,
    };
    notificationService.dispatchVerificationAlert(alertPayload);

    // Save on the server (it records the audit entry itself and always starts the request
    // as PENDING_STUDENT_CONSENT — only the student can grant consent).
    realtimeClient.syncVerificationRequest(newRequest).then(result => {
      reportSync(result, 'Create verification request', () =>
        setRequests(prev => prev.filter(r => r.id !== newReqId))
      );
      if (result.ok && result.data) {
        const saved = result.data;
        setRequests(prev => prev.map(r => (r.id === newReqId ? { ...r, ...saved } : r)));
      }
    });

    return { success: true, requestId: newReqId };
  };

  // Handler: Student grants consent
  const handleGrantConsent = (
    requestId: string,
    scope: VerificationRequest['scopeOfAccess'],
    isSimulatedFromEmployerPortal = false
  ) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const grantedTimestamp = new Date().toISOString();
    const updatedReq: VerificationRequest = {
      ...req,
      status: 'CONSENT_GRANTED',
      consentGrantedAt: grantedTimestamp,
      scopeOfAccess: scope,
    };

    setRequests(prev => prev.map(r => (r.id === requestId ? updatedReq : r)));

    const consentLog = createAuditLog(
      `Student: ${req.studentName} (APAAR: ${req.studentApaarId})`,
      'STUDENT',
      'CONSENT_GRANTED',
      req.studentApaarId,
      `Candidate explicitly granted scoped data access to ${req.employerName} under DPDP Act 2023. Scope: [${scope.join(', ')}]`,
      'SUCCESS',
      requestId
    );

    setAuditLogs(prev => [consentLog, ...prev]);

    // Saved on the server if the signed-in user is the student named on the request
    realtimeClient.updateVerificationRequest(updatedReq).then(r => {
      if (!isSimulatedFromEmployerPortal) {
        reportSync(r, 'Grant consent', () => setRequests(prev => prev.map(x => (x.id === requestId ? req : x))));
      }
    });
  };

  // Handler: Execute Scoped / OTP / Time-bound Approval Option
  const handleApproveRequestWithOptions = (
    requestId: string,
    options: {
      method: ApprovalMethod;
      scope: VerificationRequest['scopeOfAccess'];
      validityHours: number;
      aadhaarOtpVerified: boolean;
      autoApproveFuture: boolean;
    }
  ) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + options.validityHours * 3600 * 1000).toISOString();

    const updatedReq: VerificationRequest = {
      ...req,
      status: 'CONSENT_GRANTED',
      consentGrantedAt: nowIso,
      consentExpiresAt: expiryIso,
      scopeOfAccess: options.scope,
    };

    setRequests(prev =>
      prev.map(r => (r.id === requestId ? updatedReq : r))
    );

    const methodLabel =
      options.method === 'AADHAAR_OTP'
        ? 'Aadhaar OTP e-Sign verified (SIG-UIDAI-X509)'
        : options.method === 'TIME_BOUND'
        ? `Time-Bound Consent (${options.validityHours}h window)`
        : options.method === 'SCOPE_RESTRICTED'
        ? 'Custom Scoped Authorization'
        : '1-Click Express Authorization';

    const consentLog = createAuditLog(
      `Student: ${req.studentName} (APAAR: ${req.studentApaarId})`,
      'STUDENT',
      'CONSENT_GRANTED',
      req.studentApaarId,
      `Candidate granted consent via [${methodLabel}] to ${req.employerName}. Scope: [${options.scope.join(', ')}]. Validity: ${options.validityHours}h.`,
      'SUCCESS',
      requestId
    );

    setAuditLogs(prev => [consentLog, ...prev]);

    if (options.autoApproveFuture) {
      setPreferences(prev => {
        const existing = prev[req.studentApaarId] || currentPrefs;
        return {
          ...prev,
          [req.studentApaarId]: {
            ...existing,
            autoApproveVettedEmployers: true,
          },
        };
      });
    }

    // Saved on the server only if the signed-in user is the student named on the request
    realtimeClient.updateVerificationRequest(updatedReq).then(r =>
      reportSync(r, 'Approve request', () => setRequests(prev => prev.map(x => (x.id === requestId ? req : x))))
    );
  };

  // Handler: Execute APAAR ID Registration / Enrollment Approval
  const handleApproveStudentApaarEnrollment = (
    studentApaarId: string,
    details: {
      consentType: 'PARENTAL' | 'STUDENT_SELF';
      guardianName?: string;
      aadhaarVerified: boolean;
      otpUsed: string;
    }
  ) => {
    const student = students.find(s => s.apaarId === studentApaarId);
    if (!student) return;

    const updatedStudent: Student = {
      ...student,
      consentPending: false,
      status: 'Active',
      digilockerDocumentsCount: Math.max(student.digilockerDocumentsCount, 1),
    };

    setStudents(prev =>
      prev.map(s => (s.apaarId === studentApaarId ? updatedStudent : s))
    );

    const approvalLog = createAuditLog(
      details.consentType === 'PARENTAL'
        ? `Parent/Guardian: ${details.guardianName || 'Guardian'}`
        : `Student: ${student.name}`,
      'STUDENT',
      'APAAR_ENROLLMENT_APPROVED',
      student.apaarId,
      `Statutory APAAR ID consent mandate signed & approved under NEP 2020 / DoSEL regulations (${details.consentType === 'PARENTAL' ? 'Parental Consent' : 'Student Self-Declaration'}). UIDAI demographic check validated. APAAR Card activated and linked to DigiLocker.`,
      'SUCCESS',
      `ENROLL-${student.apaarId.replace(/\s+/g, '')}`
    );

    setAuditLogs(prev => [approvalLog, ...prev]);

    realtimeClient.syncStudent(updatedStudent).then(r =>
      reportSync(r, 'Approve APAAR enrolment', () =>
        setStudents(prev => prev.map(s => (s.apaarId === studentApaarId ? student : s)))
      )
    );

    notificationService.dispatchVerificationAlert({
      requestId: `APAAR-ACT-${Date.now().toString(36).toUpperCase()}`,
      studentName: student.name,
      studentApaarId: student.apaarId,
      recipientPhone: student.contactPhone,
      recipientEmail: student.contactEmail,
      employerName: 'Ministry of Education & DigiLocker',
      requestedCredentials: ['AICTE_APPROVAL'],
      purpose: 'APAAR ID Generation & Enrollment Consent Approved Successfully',
    });
  };

  // Handler: Register / Create New Student
  const handleCreateStudent = (
    newStudent: Student,
    options?: { navigateTo?: 'student-portal' | 'employer-bgv' | 'registry' }
  ) => {
    // 1. Add to students list
    setStudents(prev => {
      const updated = [newStudent, ...prev.filter(s => s.apaarId !== newStudent.apaarId)];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('apaar_created_students_v1');
          const existingList: Student[] = stored ? JSON.parse(stored) : [];
          const deduped = [newStudent, ...existingList.filter(s => s.apaarId !== newStudent.apaarId)];
          localStorage.setItem('apaar_created_students_v1', JSON.stringify(deduped));
        } catch (e) {
          console.warn('Failed to save student to localStorage', e);
        }
      }
      return updated;
    });

    // 2. Initialize default privacy preferences
    setPreferences(prev => ({
      ...prev,
      [newStudent.apaarId]: {
        autoApproveVettedEmployers: false,
        notifyViaSMS: true,
        notifyViaEmail: true,
        requireOtpForApproval: true,
        defaultValidityHours: 24,
        blacklistedEmployers: [],
        allowedCredentials: ['DEGREE', 'MARKSHEET', 'AICTE_APPROVAL', 'ABC_TRANSCRIPT'],
        dataPrivacyVersion: 'DPDP Act 2023 / Section 6',
      },
    }));

    // 3. Make this the active student
    setActiveStudentApaarId(newStudent.apaarId);

    // 4. Create immutable audit log
    const enrollmentLog = createAuditLog(
      'National Academic Depository / MoE Registrar',
      'SYSTEM',
      'APAAR_ENROLLMENT_APPROVED',
      newStudent.apaarId,
      `New student ${newStudent.name} successfully registered. 12-Digit APAAR ID ${newStudent.apaarId} generated and linked to DigiLocker NAD ledger with verified credentials.`,
      'SUCCESS',
      `REG-${newStudent.apaarId.replace(/\s+/g, '')}`
    );
    setAuditLogs(prev => [enrollmentLog, ...prev]);

    // Saved on the server for institution accounts; credentials are signed by the server
    realtimeClient.syncStudent(newStudent).then(r => reportSync(r, 'Register student'));

    // 5. Send automated SMS/Email welcome alert
    notificationService.dispatchVerificationAlert({
      requestId: `WELCOME-${Date.now().toString(36).toUpperCase()}`,
      studentName: newStudent.name,
      studentApaarId: newStudent.apaarId,
      recipientPhone: newStudent.contactPhone,
      recipientEmail: newStudent.contactEmail,
      employerName: 'Ministry of Education & DigiLocker',
      requestedCredentials: ['DEGREE'],
      purpose: `Welcome to APAAR! Your 12-digit Academic ID ${newStudent.apaarId} is active.`,
    });

    // 6. Navigate if specified
    if (options?.navigateTo) {
      setActiveTab(options.navigateTo);
    }
  };

  // Route the workspace to the signed-in user's role
  const routeToRoleWorkspace = (user: UserAccount) => {
    if (user.role === 'STUDENT' && user.apaarId) {
      const match = students.find(
        s => s.apaarId.replace(/\s+/g, '') === user.apaarId?.replace(/\s+/g, '')
      );
      if (match) {
        setActiveStudentApaarId(match.apaarId);
      }
      setActiveTab('student-portal');
    } else if (user.role === 'STUDENT') {
      setActiveTab('student-portal');
    } else if (user.role === 'EMPLOYER') {
      setActiveTab('employer-bgv');
    } else if (user.role === 'INSTITUTION') {
      setActiveTab('doc-verification');
    } else if (user.role === 'REGULATOR') {
      setActiveTab('audit-trail');
    }
  };

  const handleSelectUser = (user: UserAccount) => {
    setCurrentUser(user);
    persistActiveUserId(user.id);
    routeToRoleWorkspace(user);
  };

  // Instant 1-Click Role Switch from Navbar dropdown
  const handleSwitchAccount = async (user: UserAccount) => {
    if (user.id === currentUser.id) return;
    const res = await loginWithDemoAccount(user.email, user.id);
    if (res.ok && res.user) {
      handleLoginSuccess(res.user, false, '1-Click Role Switch');
      return;
    }
    // Fallback: switch user directly
    handleLoginSuccess(user, false, '1-Click Role Switch');
  };

  // Handler: Create and Activate New User Account
  const handleAccountCreated = (newAccount: UserAccount) => {
    // 1. Add to accounts and persist
    setAccounts(prev => {
      const updated = [newAccount, ...prev.filter(a => a.id !== newAccount.id)];
      persistUserAccounts(updated);
      return updated;
    });

    // 2. Set as active user
    setCurrentUser(newAccount);
    persistActiveUserId(newAccount.id);

    // The account and (for students) the registry entry were created on the server.
    // Only an institution can issue signed credentials, so a new student starts with none.
    if (newAccount.role === 'STUDENT' && newAccount.apaarId) {
      const apaar = newAccount.apaarId;
      const existing = students.find(
        s => s.apaarId.replace(/\s+/g, '') === apaar.replace(/\s+/g, '')
      );
      if (!existing) {
        const studentFromAccount: Student = {
          apaarId: apaar,
          pen: '',
          name: newAccount.name,
          dob: '',
          gender: 'Other',
          currentInstitution: newAccount.organization,
          stage: 'UG',
          district: '',
          status: 'Active',
          aadhaarMismatch: false,
          consentPending: false,
          hasDigilockerAccount: true,
          digilockerDocumentsCount: 0,
          abcCreditsBalance: 0,
          credentials: [],
          contactEmail: newAccount.email,
          contactPhone: newAccount.phone || '',
        };
        setStudents(prev => [studentFromAccount, ...prev]);
      }
      setActiveStudentApaarId(apaar);
    }
    routeToRoleWorkspace(newAccount);
  };

  // Handler: Student rejects request
  const handleRejectRequest = (requestId: string, reason: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const updatedReq: VerificationRequest = {
      ...req,
      status: 'CONSENT_REJECTED',
      rejectionReason: reason,
    };

    setRequests(prev =>
      prev.map(r => (r.id === requestId ? updatedReq : r))
    );

    const rejectLog = createAuditLog(
      `Student: ${req.studentName}`,
      'STUDENT',
      'CONSENT_REJECTED',
      req.studentApaarId,
      `Candidate declined verification request from ${req.employerName}. Reason: "${reason}"`,
      'ALERT',
      requestId
    );

    setAuditLogs(prev => [rejectLog, ...prev]);
    realtimeClient.updateVerificationRequest(updatedReq).then(r =>
      reportSync(r, 'Reject request', () => setRequests(prev => prev.map(x => (x.id === requestId ? req : x))))
    );
  };

  // Handler: Student revokes consent for past request
  const handleRevokeConsent = (requestId: string, reason: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const revokedTimestamp = new Date().toISOString();
    const updatedReq: VerificationRequest = {
      ...req,
      status: 'CONSENT_REVOKED',
      consentRevokedAt: revokedTimestamp,
      revocationReason: reason,
    };

    setRequests(prev =>
      prev.map(r => (r.id === requestId ? updatedReq : r))
    );

    const revokeLog = createAuditLog(
      `Student: ${req.studentName}`,
      'STUDENT',
      'CONSENT_REVOKED',
      req.studentApaarId,
      `Candidate exercised legal right to withdraw consent under DPDP Act 2023 § 6(4). Access for ${req.employerName} terminated immediately. Reason: "${reason}"`,
      'ALERT',
      requestId
    );

    setAuditLogs(prev => [revokeLog, ...prev]);
    realtimeClient.updateVerificationRequest(updatedReq).then(r =>
      reportSync(r, 'Revoke consent', () => setRequests(prev => prev.map(x => (x.id === requestId ? req : x))))
    );
  };

  // Handler: Credential verification. The server checks the signatures and OCR fields.
  const handleExecuteBackendValidation = async (requestId: string, simulateTamper = false) => {
    const req = requests.find(r => r.id === requestId);
    const serverResult = await realtimeClient.verifyRequest(requestId, simulateTamper);
    if (serverResult.ok && serverResult.data) {
      const saved = serverResult.data;
      setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, ...saved } : r)));
      return;
    }
    if (req) {
      const hrRes = await realtimeClient.hrVerifyCandidateDocument({
        requestId,
        studentApaarId: req.studentApaarId,
        hrVerifierName: req.verifierName || currentUser.name,
        hrOrganization: req.employerName || currentUser.organization,
        hrDecision: simulateTamper ? 'REJECT' : 'APPROVE',
        simulateTamper,
      });
      if (hrRes.ok && hrRes.data?.updatedRequest) {
        const saved = hrRes.data.updatedRequest;
        setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, ...saved } : r)));
        return;
      }
    }
    if (serverResult.status !== 0 && serverResult.status !== 503) {
      runLocalValidationPreview(requestId, simulateTamper);
      return;
    }
    setServerNotice({ tone: 'info', text: 'Server offline: showing a local preview check only. It is not saved and is not a real verification.' });
    runLocalValidationPreview(requestId, simulateTamper);
  };

  const runLocalValidationPreview = (requestId: string, simulateTamper = false) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const student = students.find(s => s.apaarId === req.studentApaarId);
    const targetCred = student?.credentials[0] || {
      id: 'CRED-ATTUR-DEG-01',
      type: 'DEGREE' as const,
      title: 'Bachelor of Technology (B.Tech) - Information Technology',
      issuingInstitution: 'Institute of Technology, Attur',
      issuingAuthority: 'Anna University & AICTE',
      yearOfPassing: 2023,
      cgpaOrPercentage: '8.82 CGPA',
      specialization: 'Information Technology',
      digilockerUri: `vault://apaar-registry/${req.studentApaarId.replace(/\D/g, '')}/degree/CRED-ATTUR-DEG-01`,
      aicteApprovalNumber: 'AICTE-TN-ENG-2019-8812',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      digitalSignature: 'SIG-PKI-RSA-AICTE-0912448A8F',
      issuerCertificateSerial: 'NAD-AICTE-PKI-2023-74198E',
      timestamp: new Date().toISOString(),
    };

    const validationResult = verifyDigitalSignature(targetCred, simulateTamper);
    const nowIso = new Date().toISOString();

    if (validationResult.isVerified) {
      const updatedReq: VerificationRequest = {
        ...req,
        status: 'VERIFIED',
        backendValidation: {
          repositoryChecked: 'APAAR Secure Credential Vault',
          signatureAlgorithm: validationResult.algorithm,
          certificateSerial: validationResult.certificateSerial,
          issuerCA: validationResult.issuerCA,
          sha256Digest: validationResult.computedHash,
          verifiedAt: nowIso,
          isTampered: false,
          networkLatencyMs: validationResult.networkLatencyMs,
        },
      };

      setRequests(prev =>
        prev.map(r => (r.id === requestId ? updatedReq : r))
      );

      const logQuery = createAuditLog(
        'APAAR Secure Credential Vault Gateway',
        'APAAR_VAULT',
        'AICTE_REPOSITORY_QUERIED',
        req.studentApaarId,
        `Retrieved authoritative master record for ${req.studentName} from APAAR Secure Credential Vault.`,
        'INFO',
        requestId
      );

      const logVerified = createAuditLog(
        'APAAR Vault Cryptographic Engine',
        'APAAR_VAULT',
        'DIGITAL_SIGNATURE_VERIFIED',
        req.studentApaarId,
        `Verified HMAC-SHA256 digital signature from APAAR Secure Credential Vault Root CA. Checksum matched 100%. Verified status confirmed for ${req.employerName}.`,
        'SUCCESS',
        requestId
      );

      setAuditLogs(prev => [logVerified, logQuery, ...prev]);
    } else {
      const updatedReq: VerificationRequest = {
        ...req,
        status: 'TAMPERED_FAILED',
        backendValidation: {
          repositoryChecked: 'AICTE Central Repository',
          signatureAlgorithm: validationResult.algorithm,
          certificateSerial: validationResult.certificateSerial,
          issuerCA: validationResult.issuerCA,
          sha256Digest: validationResult.computedHash,
          verifiedAt: nowIso,
          isTampered: true,
          tamperDetails: validationResult.tamperReason,
          networkLatencyMs: validationResult.networkLatencyMs,
        },
      };

      setRequests(prev =>
        prev.map(r => (r.id === requestId ? updatedReq : r))
      );

      const logTamper = createAuditLog(
        'Security Cryptographic Engine',
        'SYSTEM',
        'SECURITY_TAMPER_ALERT',
        req.studentApaarId,
        `SECURITY ALERT: Digital signature mismatch detected! Certificate payload has been altered or forged. Verification failed for ${req.employerName}.`,
        'ALERT',
        requestId
      );

      setAuditLogs(prev => [logTamper, ...prev]);
    }
  };

  // Handler: Update student privacy preferences
  const handleUpdatePreferences = (newPrefs: StudentConsentPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [activeStudentApaarId]: newPrefs,
    }));

    const prefLog = createAuditLog(
      `Student: ${currentStudent.name}`,
      'STUDENT',
      'PREFERENCES_UPDATED',
      currentStudent.apaarId,
      `Updated DPDP consent rules: AutoApprove=${newPrefs.autoApproveVettedEmployers}, RequireOTP=${newPrefs.requireOtpForApproval}, Validity=${newPrefs.defaultValidityHours}h, Blacklisted=${newPrefs.blacklistedEmployers.length} orgs.`,
      'INFO'
    );

    setAuditLogs(prev => [prefLog, ...prev]);
    realtimeClient.syncAuditLog(prefLog);
  };

  // Cross navigation helpers
  const handleSelectStudentForVerification = (apaarId: string) => {
    setActiveTab('employer-bgv');
  };

  const handleSelectStudentForConsent = (apaarId: string) => {
    setActiveStudentApaarId(apaarId);
    setActiveTab('student-portal');
  };

  const handleViewAuditTrail = (reqId?: string) => {
    setAuditFilterRequestId(reqId);
    setActiveTab('audit-trail');
  };

  const handleLoginSuccess = (
    user: UserAccount,
    isNewAccount = false,
    authMethodLabel = 'Portal Login'
  ) => {
    const loginLog = createAuditLog(
      `${user.name} (${user.role})`,
      user.role === 'STUDENT' ? 'STUDENT' : user.role === 'EMPLOYER' ? 'EMPLOYER' : 'SYSTEM',
      'PREFERENCES_UPDATED',
      user.apaarId || 'AUTH_GATEWAY',
      `Authenticated into APAAR Portal via ${authMethodLabel}. Organization: ${user.organization}.`,
      'SUCCESS'
    );

    // The server records the sign-in in the audit trail itself.
    setAccounts(prev => {
      const updated = [user, ...prev.filter(a => a.id !== user.id && a.email !== user.email)];
      persistUserAccounts(updated);
      return updated;
    });
    if (isNewAccount) {
      handleAccountCreated(user);
    } else {
      handleSelectUser(user);
    }
    setLoginPrefillEmail(undefined);

    // Also sync to Firestore if authenticated via Firebase Google SSO
    syncUserProfileToFirestore(user).catch(() => {});
    recordFirestoreSessionLog({
      id: loginLog.id,
      actor: loginLog.actor,
      action: loginLog.action,
      targetApaarId: loginLog.studentApaarId,
      details: loginLog.details,
      status: loginLog.level,
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('apaar_manual_signout');
    }
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('apaar_manual_signout', '1');
    }
    auth.signOut().catch(() => {});
    signOutLocally();
    realtimeClient.disconnect();
    setIsAuthenticated(false);
  };

  if (isRestoringSession && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0c121d] text-sm text-slate-500 dark:text-slate-400">
        Restoring your session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage
          key={loginPrefillEmail || 'login'}
          prefillEmail={loginPrefillEmail}
          accounts={accounts}
          students={students}
          onLoginSuccess={handleLoginSuccess}
          onOpenGuideModal={() => setIsGuideModalOpen(true)}
          isRealtimeConnected={true}
          totalVerifiedCount={requests.filter(r => r.status === 'VERIFIED').length}
        />
        <ApaarGuideModal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
          onOpenCreateAccount={() => setIsGuideModalOpen(false)}
          onOpenStudentRegistration={() => setIsGuideModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen apaar-guilloche-bg bg-[#f7f6f2] dark:bg-[#0c121d] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 transition-colors">
      <PrototypeBanner />
      {/* Strict 3-zone Navbar with Light/Dark toggle, account switcher, and help guide */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingConsentCount={studentPendingCount}
        activeStudentName={currentStudent.name}
        onOpenCreateStudentModal={() => setIsCreateStudentModalOpen(true)}
        onOpenCreateAccountModal={() => setIsCreateAccountModalOpen(true)}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onOpenNotificationModal={() => {
          if (alertHistory.length > 0) {
            setActiveAlertModal(alertHistory[0]);
          } else {
            // Create sample alert if history is empty
            const sample = notificationService.dispatchVerificationAlert({
              requestId: 'BGV-2026-9041',
              studentName: currentStudent.name,
              studentApaarId: currentStudent.apaarId,
              recipientPhone: currentStudent.contactPhone,
              recipientEmail: currentStudent.contactEmail,
              employerName: 'Tata Consultancy Services',
              requestedCredentials: ['DEGREE', 'MARKSHEET', 'AICTE_APPROVAL'],
              purpose: 'Pre-Employment Background Verification for Systems Engineer',
            });
            setActiveAlertModal(sample);
          }
        }}
        unreadAlertCount={alertHistory.filter(a => !a.read).length}
        currentUser={currentUser}
        allAccounts={accounts}
        onSelectUser={handleSwitchAccount}
        onSignOut={handleSignOut}
      />

      {/* Sovereign APAAR Smart Identity Pass & Live Command Deck */}
      <SovereignCommandDeck
        currentUser={currentUser}
        currentStudent={currentStudent}
        students={students}
        requests={requests}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSelectStudent={id => setActiveStudentApaarId(id)}
        onInspectCredential={cred => setSelectedCredentialForModal(cred)}
        onOpenCreateAccountModal={() => setIsCreateAccountModalOpen(true)}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onOpenCreateStudentModal={() => setIsCreateStudentModalOpen(true)}
        allAccounts={accounts}
        onSwitchRole={handleSwitchAccount}
      />

      {/* Institution Pending Regulator Approval Banner */}
      {currentUser.role === 'INSTITUTION' && currentUser.institutionApproved === false && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-800 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Pending Regulator Approval:</strong> Self-registered Institution accounts (<em>{currentUser.organization}</em>) require AICTE / MoE Regulator approval before they can register students or issue signed credentials.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 font-semibold text-[11px] shrink-0">
              Awaiting Regulator Sign-Off
            </span>
          </div>
        </div>
      )}

      {/* Regulator Institution Approval Queue */}
      {currentUser.role === 'REGULATOR' && accounts.some(a => a.role === 'INSTITUTION' && a.institutionApproved === false) && (
        <div className="bg-purple-50 dark:bg-purple-950/50 border-b border-purple-300 dark:border-purple-800 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-col gap-2 text-xs">
            <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Pending Institution Account Approvals ({accounts.filter(a => a.role === 'INSTITUTION' && a.institutionApproved === false).length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {accounts
                .filter(a => a.role === 'INSTITUTION' && a.institutionApproved === false)
                .map(inst => (
                  <div
                    key={inst.id}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 shadow-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{inst.organization}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {inst.name} · {inst.email}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await realtimeClient.approveInstitution(inst.id, true);
                        if (res.ok && res.data) {
                          setAccounts(prev => {
                            const next = prev.map(a => (a.id === inst.id ? { ...a, institutionApproved: true } : a));
                            persistUserAccounts(next);
                            return next;
                          });
                        } else {
                          reportSync(res, 'Approve institution account');
                        }
                      }}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Approve Institution</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Floating SMS / Email Dispatch Toast Banner (Positioned safely at bottom-right) */}
      {toastAlert && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-40 max-w-md w-full animate-in slide-in-from-bottom-4 duration-300 shadow-2xl">
          <div className="bg-white dark:bg-[#111927] border-2 border-amber-500 rounded-xl p-4 shadow-2xl flex items-start gap-3 backdrop-blur-md">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Incoming BGV Request</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </span>
                <button
                  onClick={() => setToastAlert(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                <strong className="text-amber-600 dark:text-amber-400">{toastAlert.employerName}</strong> requested verification of your academic records.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    const req = requests.find(r => r.id === toastAlert.requestId);
                    if (req) {
                      setApprovalModalState({
                        isOpen: true,
                        mode: 'REQUEST_APPROVAL',
                        request: req,
                      });
                    }
                    setToastAlert(null);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs"
                  title="Open full APAAR Approval options modal (Aadhaar OTP, time limits, scope)"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Approval Options</span>
                </button>

                <button
                  onClick={() => {
                    setActiveAlertModal(toastAlert);
                    setToastAlert(null);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs flex items-center gap-1 border border-slate-300 dark:border-slate-700"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Alerts</span>
                </button>

                <button
                  onClick={() => {
                    handleGrantConsent(toastAlert.requestId, ['IDENTITY', 'ACADEMIC_MARKS', 'DIGITAL_SIGNATURE']);
                    setToastAlert(null);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs"
                >
                  Quick Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server notice (refused or offline actions) */}
      {serverNotice && (
        <div
          role="status"
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[calc(100%-2rem)] px-4 py-3 rounded-xl border shadow-xl text-xs flex items-start gap-3 ${
            serverNotice.tone === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{serverNotice.text}</span>
          <button onClick={() => setServerNotice(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'employer-bgv' && (
          <EmployerPortal
            students={students}
            requests={requests}
            onSubmitRequest={handleSubmitRequest}
            onSimulateConsentApproval={reqId =>
              handleGrantConsent(reqId, ['IDENTITY', 'ACADEMIC_MARKS', 'DIGITAL_SIGNATURE'], true)
            }
            onExecuteBackendValidation={handleExecuteBackendValidation}
            onHrRequestUpdated={updatedReq =>
              setRequests(prev => prev.map(r => (r.id === updatedReq.id ? { ...r, ...updatedReq } : r)))
            }
            onViewAuditTrail={handleViewAuditTrail}
            onViewCertificateDetails={cred => setSelectedCredentialForModal(cred)}
            onSwitchToStudentView={() => setActiveTab('student-portal')}
          />
        )}

        {activeTab === 'doc-verification' && (
          <DocumentVerificationView
            students={students}
            onViewCertificateDetails={cred => setSelectedCredentialForModal(cred)}
            onStudentCredentialAdded={(apaarId, newCred) => {
              setStudents(prev =>
                prev.map(s =>
                  s.apaarId === apaarId
                    ? {
                        ...s,
                        digilockerDocumentsCount: Math.max(s.digilockerDocumentsCount + 1, s.credentials.length + 1),
                        credentials: [newCred, ...s.credentials.filter(c => c.id !== newCred.id)],
                      }
                    : s
                )
              );
            }}
            onLogAuditAction={(action, details, level) => {
              const newLog = createAuditLog(
                'Verifier: APAAR Secure Credential Vault',
                'EMPLOYER',
                action,
                activeStudentApaarId,
                details,
                level
              );
              setAuditLogs(prev => [newLog, ...prev]);
            }}
          />
        )}

        {activeTab === 'student-portal' && (
          <StudentPortal
            currentStudent={currentStudent}
            allStudents={students}
            onSelectStudent={id => setActiveStudentApaarId(id)}
            requests={requests}
            preferences={currentPrefs}
            onGrantConsent={handleGrantConsent}
            onRejectRequest={handleRejectRequest}
            onRevokeConsent={handleRevokeConsent}
            onUpdatePreferences={handleUpdatePreferences}
            onViewCertificateDetails={cred => setSelectedCredentialForModal(cred)}
            onOpenApprovalModal={req =>
              setApprovalModalState({
                isOpen: true,
                mode: 'REQUEST_APPROVAL',
                request: req,
              })
            }
            onOpenEnrollmentModal={stu =>
              setApprovalModalState({
                isOpen: true,
                mode: 'APAAR_ENROLLMENT_APPROVAL',
                student: stu,
              })
            }
            onOpenCreateStudentModal={() => setIsCreateStudentModalOpen(true)}
            onStudentCredentialAdded={(apaarId, newCred) => {
              setStudents(prev =>
                prev.map(s =>
                  s.apaarId === apaarId
                    ? {
                        ...s,
                        digilockerDocumentsCount: Math.max(s.digilockerDocumentsCount + 1, s.credentials.length + 1),
                        credentials: [newCred, ...s.credentials.filter(c => c.id !== newCred.id)],
                      }
                    : s
                )
              );
            }}
          />
        )}


        {activeTab === 'registry' && (
          <RegistryView
            students={students}
            onSelectStudentForVerification={handleSelectStudentForVerification}
            onSelectStudentForConsent={handleSelectStudentForConsent}
            onApproveStudentApaar={stu =>
              setApprovalModalState({
                isOpen: true,
                mode: 'APAAR_ENROLLMENT_APPROVAL',
                student: stu,
              })
            }
            onOpenCreateStudentModal={() => setIsCreateStudentModalOpen(true)}
          />
        )}


        {activeTab === 'lookup' && (
          <LookupView
            students={students}
            onSelectStudentForVerification={handleSelectStudentForVerification}
            onSelectStudentForConsent={handleSelectStudentForConsent}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsView
            students={students}
            onStudentCreated={stu => handleCreateStudent(stu)}
            onNavigateTab={tab => setActiveTab(tab)}
          />
        )}

        {activeTab === 'audit-trail' && (
          <AuditTrailView
            logs={auditLogs}
            initialFilterRequestId={auditFilterRequestId}
          />
        )}
      </main>

      {/* APAAR Approval Options Modal */}
      {approvalModalState?.isOpen && (
        <ApaarApprovalModal
          isOpen={approvalModalState.isOpen}
          mode={approvalModalState.mode}
          request={approvalModalState.request}
          student={approvalModalState.student}
          onClose={() => setApprovalModalState(null)}
          onApproveRequest={handleApproveRequestWithOptions}
          onRejectRequest={handleRejectRequest}
          onApproveEnrollment={handleApproveStudentApaarEnrollment}
        />
      )}

      {/* Certificate Inspection Modal */}
      {selectedCredentialForModal && (
        <CertificateModal
          credential={selectedCredentialForModal}
          student={currentStudent}
          onClose={() => setSelectedCredentialForModal(null)}
        />
      )}

      {/* Real-Time SMS / Email / Browser Notification Simulation Modal */}
      {activeAlertModal && (
        <NotificationModal
          currentAlert={activeAlertModal}
          onClose={() => setActiveAlertModal(null)}
          onGrantConsent={reqId => {
            handleGrantConsent(reqId, ['IDENTITY', 'ACADEMIC_MARKS', 'DIGITAL_SIGNATURE']);
          }}
          onRejectRequest={reqId => {
            handleRejectRequest(reqId, 'Candidate rejected via mobile alert notification.');
          }}
          onOpenStudentPortal={() => {
            setActiveTab('student-portal');
          }}
        />
      )}

      {/* Register New Student Modal */}
      {isCreateStudentModalOpen && (
        <CreateStudentModal
          isOpen={isCreateStudentModalOpen}
          onClose={() => setIsCreateStudentModalOpen(false)}
          onStudentCreated={handleCreateStudent}
          existingApaarIds={students.map(s => s.apaarId)}
        />
      )}

      {/* Create New User Account Modal */}
      {isCreateAccountModalOpen && (
        <CreateAccountModal
          isOpen={isCreateAccountModalOpen}
          onClose={() => setIsCreateAccountModalOpen(false)}
          onAccountCreated={handleAccountCreated}
          existingAccounts={accounts}
          existingApaarIds={students.map(s => s.apaarId)}
        />
      )}

      {/* APAAR Portal Guide & Help Modal */}
      {isGuideModalOpen && (
        <ApaarGuideModal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
          onOpenCreateAccount={() => setIsCreateAccountModalOpen(true)}
          onOpenStudentRegistration={() => setIsCreateStudentModalOpen(true)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090e17] py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            APAAR registry prototype · Not an official Government of India website
          </span>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span>DPDP Act 2023 Compliant</span>
            <span aria-hidden="true">·</span>
            <span>AICTE Central Repository Integration</span>
            <span aria-hidden="true">·</span>
            <span>DigiLocker NAD Verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
