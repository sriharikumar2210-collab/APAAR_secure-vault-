/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SimulatedAlert {
  id: string;
  requestId: string;
  timestamp: string;
  studentName: string;
  studentApaarId: string;
  recipientPhone: string;
  recipientEmail: string;
  employerName: string;
  requestedCredentials: string[];
  purpose: string;
  smsMessage: string;
  emailSubject: string;
  emailHtml: string;
  channel: 'SMS' | 'EMAIL' | 'BROWSER_PUSH' | 'ALL';
  read: boolean;
}

type NotificationSubscriber = (alert: SimulatedAlert) => void;

class NotificationService {
  private subscribers: Set<NotificationSubscriber> = new Set();
  private alertHistory: SimulatedAlert[] = [];

  /**
   * Subscribe to incoming notifications
   */
  public subscribe(callback: NotificationSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Request permission for Native Web Notification API
   */
  public async requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      if (Notification.permission === 'granted') {
        return 'granted';
      }
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  /**
   * Get current browser notification status
   */
  public getBrowserPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Dispatches real-time SMS, Email, and Web Notification for a verification request
   */
  public dispatchVerificationAlert(params: {
    requestId: string;
    studentName: string;
    studentApaarId: string;
    recipientPhone: string;
    recipientEmail: string;
    employerName: string;
    requestedCredentials: string[];
    purpose: string;
  }): SimulatedAlert {
    const timestamp = new Date().toISOString();
    const alertId = `ALERT-${Date.now().toString(36).toUpperCase()}`;

    // Standardized TRAI / Gov. of India SMS format
    const smsMessage = `[Govt of India - APAAR BGV Alert] ${params.employerName} has requested verification of your [${params.requestedCredentials.join(', ')}] for "${params.purpose}". Your data is protected under DPDP Act 2023. Review and grant/deny consent at: https://apaar.gov.in/consent/${params.requestId} (Valid 24h). Do not share OTP with anyone.`;

    const emailSubject = `[Action Required] Verification Request from ${params.employerName} · APAAR ID: ${params.studentApaarId}`;

    const emailHtml = `
Dear ${params.studentName},

An academic background verification request has been initiated against your Automated Permanent Academic Account Registry (APAAR) account:

• Employer: ${params.employerName}
• Request ID: #${params.requestId}
• Credentials Requested: ${params.requestedCredentials.join(', ')}
• Stated Purpose: ${params.purpose}
• Timestamp: ${new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST

DATA PRIVACY NOTICE (DPDP ACT 2023):
Under Section 6 of the Digital Personal Data Protection Act 2023, your academic records and DigiLocker credentials are secure and will NOT be released to ${params.employerName} unless you explicitly approve this request.

Please log in to your APAAR Student Portal to grant or decline consent.
`;

    const alert: SimulatedAlert = {
      id: alertId,
      requestId: params.requestId,
      timestamp,
      studentName: params.studentName,
      studentApaarId: params.studentApaarId,
      recipientPhone: params.recipientPhone,
      recipientEmail: params.recipientEmail,
      employerName: params.employerName,
      requestedCredentials: params.requestedCredentials,
      purpose: params.purpose,
      smsMessage,
      emailSubject,
      emailHtml,
      channel: 'ALL',
      read: false,
    };

    // Store in history
    this.alertHistory.unshift(alert);

    // Try triggering Native Web Notification if permitted
    this.triggerNativeBrowserNotification(alert);

    // Broadcast to UI subscribers (modal, toast, navbar)
    this.subscribers.forEach(cb => {
      try {
        cb(alert);
      } catch (err) {
        console.error('Error notifying subscriber:', err);
      }
    });

    return alert;
  }

  /**
   * Helper to trigger native browser Web Notification
   */
  private triggerNativeBrowserNotification(alert: SimulatedAlert): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(`APAAR BGV Request: ${alert.employerName}`, {
          body: `${alert.employerName} requested access to your ${alert.requestedCredentials.join(', ')}. Action required to grant or deny consent under DPDP Act.`,
          icon: '/favicon.ico',
          tag: alert.requestId,
        });
      } catch {
        // Ignored if notifications blocked in iframe sandbox
      }
    }
  }

  public getHistory(): SimulatedAlert[] {
    return [...this.alertHistory];
  }

  public markAsRead(id: string): void {
    const found = this.alertHistory.find(a => a.id === id);
    if (found) found.read = true;
  }

  public clearHistory(): void {
    this.alertHistory = [];
  }
}

export const notificationService = new NotificationService();
