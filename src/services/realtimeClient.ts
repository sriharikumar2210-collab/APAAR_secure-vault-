/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, VerificationRequest, AuditLogEntry, AcademicCredential } from '../types';
import { UserAccount } from '../types/auth';
import { loadStoredSessionToken } from '../utils/authEngine';

export interface RealtimeMessage {
  type:
    | 'connected'
    | 'presence:update'
    | 'student:upserted'
    | 'request:upserted'
    | 'audit:created'
    | 'user:synced'
    | 'alert:dispatched';
  payload: any;
  timestamp: string;
}

/** Result of a write sent to the server. status 0 = server unreachable. */
export interface SyncResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type RealtimeListener = (event: RealtimeMessage) => void;

class RealtimeSyncService {
  private listeners = new Set<RealtimeListener>();
  private eventSource: EventSource | null = null;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private activePeers = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  /** Opens the live-update channels with the current session token. Call after sign-in. */
  public connect(): () => void {
    if (typeof window === 'undefined') return () => {};
    const token = loadStoredSessionToken();
    if (!token) return () => {};
    this.stopped = false;
    this.initEventSource(token);
    this.initWebSocket(token);
    return () => this.disconnect();
  }

  private initEventSource(token: string) {
    this.eventSource?.close();
    try {
      // EventSource cannot send headers, so the token goes in the query string.
      const es = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);
      this.eventSource = es;
      es.onopen = () => {
        this.isConnected = true;
      };
      es.onmessage = event => {
        try {
          this.handleIncomingEvent(JSON.parse(event.data));
        } catch {
          // heartbeat comments are not JSON
        }
      };
      es.onerror = () => {
        this.isConnected = false;
      };
    } catch (err) {
      console.warn('SSE unavailable:', err);
    }
  }

  private initWebSocket(token: string) {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      this.ws = socket;
      socket.onopen = () => {
        this.isConnected = true;
      };
      socket.onmessage = event => {
        try {
          this.handleIncomingEvent(JSON.parse(event.data));
        } catch {
          // ignore
        }
      };
      socket.onclose = () => {
        if (this.stopped) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          const current = loadStoredSessionToken();
          if (current && !this.stopped) this.initWebSocket(current);
        }, 5000);
      };
    } catch {
      // SSE is the fallback
    }
  }

  private lastEventSignature = '';

  private handleIncomingEvent(event: RealtimeMessage) {
    const sig = `${event.type}:${event.timestamp}:${JSON.stringify(event.payload).slice(0, 80)}`;
    if (sig === this.lastEventSignature) return; // same event via SSE and WS
    this.lastEventSignature = sig;
    if ((event.type === 'connected' || event.type === 'presence:update') && typeof event.payload?.activeConnections === 'number') {
      this.activePeers = Math.max(1, event.payload.activeConnections);
    }
    this.listeners.forEach(listener => listener(event));
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.eventSource?.close();
    this.eventSource = null;
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  public getStatus() {
    return { isConnected: this.isConnected, activePeers: this.activePeers };
  }

  private async send<T = any>(method: string, url: string, body?: unknown): Promise<SyncResult<T>> {
    const token = loadStoredSessionToken();
    if (!token) return { ok: false, status: 401, error: 'Not signed in.' };
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) return { ok: false, status: res.status, error: data?.error || `Request failed (${res.status})` };
      return { ok: true, status: res.status, data };
    } catch {
      return { ok: false, status: 0, error: 'Server unreachable' };
    }
  }

  // --- Authenticated REST helpers (the server decides what each user may see and do) ---

  public async fetchInitialState(): Promise<{
    students: Student[];
    requests: VerificationRequest[];
    auditLogs: AuditLogEntry[];
    users: any[];
    activeConnections: number;
  } | null> {
    const result = await this.send('GET', '/api/db/state');
    return result.ok ? result.data : null;
  }

  public syncStudent(student: Student) {
    return this.send<Student>('POST', '/api/db/students', student);
  }

  public syncVerificationRequest(request: VerificationRequest) {
    return this.send<VerificationRequest>('POST', '/api/db/requests', request);
  }

  /** Sends a consent decision (grant / reject / revoke) for a request. */
  public updateVerificationRequest(request: VerificationRequest) {
    return this.send<VerificationRequest>('PATCH', `/api/db/requests/${encodeURIComponent(request.id)}`, {
      status: request.status,
      scopeOfAccess: request.scopeOfAccess,
      consentExpiresAt: request.consentExpiresAt,
      rejectionReason: request.rejectionReason,
      revocationReason: request.revocationReason,
    });
  }

  /** Asks the server to check the credential signatures. Only the server can mark a request VERIFIED. */
  public verifyRequest(requestId: string, simulateTamper = false) {
    return this.send<VerificationRequest>('POST', `/api/db/requests/${encodeURIComponent(requestId)}/verify`, { simulateTamper });
  }

  /** Records a user activity note. Consent, requests and verification are logged by the server itself. */
  public syncAuditLog(log: AuditLogEntry) {
    return this.send<AuditLogEntry>('POST', '/api/db/audit-logs', {
      action: log.action,
      studentApaarId: log.studentApaarId,
      details: log.details,
      level: log.level,
    });
  }

  public syncUserAccount(user: UserAccount) {
    return this.send('POST', '/api/db/users/sync', {
      name: user.name,
      organization: user.organization,
      designation: user.designation,
      phone: user.phone,
    });
  }

  public approveInstitution(uid: string, approved = true) {
    return this.send<UserAccount>('POST', `/api/db/users/${encodeURIComponent(uid)}/approve-institution`, { approved });
  }

  public getVaultStatus() {
    return this.send<{
      status: string;
      vaultEngine: string;
      signatureAlgorithm: string;
      issuerSerial: string;
      rootAuthority: string;
      totalSealedCredentials: number;
      totalStudentsInVault: number;
      totalUploadedDocuments: number;
      database?: {
        connected: boolean;
        databaseName: string;
        projectId: string;
        storageEngine: string;
        postgresActive: boolean;
        persistentLedgerFile: string;
        totalStudents: number;
        totalSealedCredentials: number;
        totalUploadedDocuments: number;
        totalAuditLogs: number;
        lastSyncedAt: string;
      };
      timestamp: string;
    }>('GET', '/api/vault/status');
  }

  public getVaultCredentials(studentApaarId?: string) {
    const qs = studentApaarId ? `?studentApaarId=${encodeURIComponent(studentApaarId)}` : '';
    return this.send<{
      database: {
        connected: boolean;
        databaseName: string;
        projectId: string;
        storageEngine: string;
        postgresActive: boolean;
        persistentLedgerFile: string;
        totalStudents: number;
        totalSealedCredentials: number;
        totalUploadedDocuments: number;
        totalAuditLogs: number;
        lastSyncedAt: string;
      };
      credentials: (AcademicCredential & { studentApaarId: string; studentName: string })[];
    }>('GET', `/api/vault/credentials${qs}`);
  }

  public issueVaultCredential(params: {
    studentApaarId: string;
    type: AcademicCredential['type'];
    title: string;
    issuingInstitution?: string;
    issuingAuthority?: string;
    yearOfPassing: number;
    cgpaOrPercentage: string;
    specialization?: string;
    aicteApprovalNumber?: string;
    documentFileName?: string;
    documentMimeType?: string;
    documentSizeBytes?: number;
    documentDataUrl?: string;
  }) {
    return this.send<{
      credential: AcademicCredential;
      receipt: any;
      student: Student | null;
    }>('POST', '/api/vault/issue', params);
  }

  public uploadVaultDocument(params: {
    studentApaarId: string;
    type: AcademicCredential['type'];
    title: string;
    issuingInstitution?: string;
    issuingAuthority?: string;
    yearOfPassing: number;
    cgpaOrPercentage: string;
    specialization?: string;
    aicteApprovalNumber?: string;
    documentFileName: string;
    documentMimeType: string;
    documentSizeBytes: number;
    documentDataUrl: string;
  }) {
    return this.send<{
      credential: AcademicCredential;
      receipt: any;
      ocrReport?: import('../utils/vaultEngine').VaultOcrVerificationReport;
      student: Student | null;
    }>('POST', '/api/vault/upload', params);
  }

  public verifyVaultCredential(credentialId: string, simulateTamper = false) {
    const qs = simulateTamper ? '?simulateTamper=true' : '';
    return this.send<{
      verified: boolean;
      reason?: string;
      computedDigest: string;
      storedDigest: string;
      signatureAlgorithm: string;
      issuerSerial: string;
      vaultAuthority: string;
      verifiedAt: string;
      receipt: any;
      ocrReport?: import('../utils/vaultEngine').VaultOcrVerificationReport;
    }>('GET', `/api/vault/verify/${encodeURIComponent(credentialId)}${qs}`);
  }

  public ocrVerifyVaultDocument(params: {
    credentialId?: string;
    studentApaarId?: string;
    fileName?: string;
    mimeType?: string;
    dataUrl?: string;
    simulateTamper?: boolean;
  }) {
    return this.send<{
      verified: boolean;
      ocrReport: import('../utils/vaultEngine').VaultOcrVerificationReport;
      receipt: any;
    }>('POST', '/api/vault/ocr-verify', params);
  }

  public hrVerifyCandidateDocument(params: {
    requestId?: string;
    studentApaarId: string;
    credentialId?: string;
    hrVerifierName?: string;
    hrOrganization?: string;
    hrRemarks?: string;
    hrDecision?: 'APPROVE' | 'REJECT' | 'AUTO';
    fileName?: string;
    mimeType?: string;
    dataUrl?: string;
    simulateTamper?: boolean;
  }) {
    return this.send<{
      verified: boolean;
      hrReport: import('../utils/vaultEngine').HrVerificationDecisionReport;
      ocrReport: import('../utils/vaultEngine').VaultOcrVerificationReport;
      receipt: any;
      updatedRequest?: VerificationRequest | null;
    }>('POST', '/api/vault/hr-verify', params);
  }
}

export const realtimeClient = new RealtimeSyncService();

