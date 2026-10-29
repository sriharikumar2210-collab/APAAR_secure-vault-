/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser side of sign-in. Every check (password, OTP, Google token, role) happens on the
 * server; the browser only keeps the session token the server returns.
 */

import { UserAccount, UserRole } from '../types/auth';
import { loadStoredSessionToken, persistStoredSessionToken } from '../utils/authEngine';

export interface AuthResult {
  ok: boolean;
  user?: UserAccount;
  error?: string;
}

const AVATAR_BY_ROLE: Record<UserRole, string> = {
  STUDENT: 'bg-amber-500',
  EMPLOYER: 'bg-emerald-600',
  INSTITUTION: 'bg-blue-600',
  REGULATOR: 'bg-purple-600',
};

export function toUserAccount(serverUser: any): UserAccount {
  return {
    id: serverUser.id,
    name: serverUser.name,
    email: serverUser.email,
    role: serverUser.role,
    organization: serverUser.organization,
    designation: serverUser.designation || undefined,
    phone: serverUser.phone || undefined,
    apaarId: serverUser.apaarId || undefined,
    institutionApproved: serverUser.institutionApproved !== undefined ? serverUser.institutionApproved : true,
    avatarBg: AVATAR_BY_ROLE[serverUser.role as UserRole] || 'bg-amber-500',
    createdAt: serverUser.createdAt || new Date().toISOString(),
    lastActive: serverUser.lastActive || new Date().toISOString(),
  };
}

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

function errorText(status: number, json: any): string {
  if (status === 0) return 'Cannot reach the server. Check that it is running.';
  if (status === 503) return json?.error || 'The server database is not available.';
  return json?.error || `Request failed (${status}).`;
}

function finishSession(status: number, json: any): AuthResult {
  if (status >= 200 && status < 300 && json?.token && json?.user) {
    persistStoredSessionToken(json.token);
    return { ok: true, user: toUserAccount(json.user) };
  }
  return { ok: false, error: errorText(status, json) };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const { status, json } = await post('/api/auth/login', { email, password });
  return finishSession(status, json);
}

export async function loginWithDemoAccount(email: string, userId?: string): Promise<AuthResult> {
  const { status, json } = await post('/api/auth/demo-login', { email, userId });
  if (status >= 200 && status < 300 && json?.token && json?.user) {
    return finishSession(status, json);
  }
  return loginWithPassword(email, 'Apaar@2026');
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organization: string;
  designation?: string;
  phone?: string;
  apaarId?: string;
}): Promise<AuthResult> {
  const { status, json } = await post('/api/auth/register', input);
  return finishSession(status, json);
}

export async function requestApaarOtp(
  apaarId: string
): Promise<{ ok: boolean; message?: string; devOtp?: string; error?: string }> {
  const { status, json } = await post('/api/auth/otp/request', { apaarId });
  if (status === 200) return { ok: true, message: json?.message, devOtp: json?.devOtp };
  return { ok: false, error: errorText(status, json) };
}

export async function loginWithApaarOtp(apaarId: string, otp: string): Promise<AuthResult> {
  const { status, json } = await post('/api/auth/otp/verify', { apaarId, otp });
  return finishSession(status, json);
}

export async function loginWithFirebaseIdToken(idToken: string): Promise<AuthResult> {
  const { status, json } = await post('/api/auth/firebase', { idToken });
  return finishSession(status, json);
}

/** Restores the signed-in user from a stored token, or returns null if it is missing or expired. */
export async function restoreSession(): Promise<UserAccount | null> {
  const token = loadStoredSessionToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      persistStoredSessionToken(null);
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.user ? toUserAccount(json.user) : null;
  } catch {
    return null;
  }
}

export function signOutLocally(): void {
  const token = loadStoredSessionToken();
  persistStoredSessionToken(null);
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}
