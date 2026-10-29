/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserAccount, UserRole, CreateAccountInput } from '../types/auth';
import { DEFAULT_USER_ACCOUNTS } from '../data/demoAccounts';

export const USER_ACCOUNTS_STORAGE_KEY = 'apaar_user_accounts_v2';
export const ACTIVE_USER_STORAGE_KEY = 'apaar_active_user_id_v2';
export const AUTH_SESSION_STORAGE_KEY = 'apaar_auth_session_active_v1';
export const AUTH_TOKEN_STORAGE_KEY = 'apaar_session_token_v1';

// Demo accounts live in src/data/demoAccounts.ts. They have no password in the code:
// the server sets it from DEMO_PASSWORD (or prints a random one in development).
export { DEFAULT_USER_ACCOUNTS } from '../data/demoAccounts';

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-amber-500',
  'bg-blue-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-indigo-600',
];

/**
 * Validates account creation fields
 */
export function validateCreateAccount(input: Partial<CreateAccountInput>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }

  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Please provide a valid email address.';
  }

  if (!input.role || !['STUDENT', 'EMPLOYER', 'INSTITUTION', 'REGULATOR'].includes(input.role)) {
    errors.role = 'Please select a valid role.';
  }

  if (!input.organization || input.organization.trim().length < 2) {
    errors.organization =
      input.role === 'STUDENT'
        ? 'Please specify your College/University name.'
        : 'Organization or Company name is required.';
  }

  if (input.phone && !/^\+?[0-9\s-]{8,15}$/.test(input.phone.trim())) {
    errors.phone = 'Please provide a valid contact number.';
  }

  if (input.passwordPin !== undefined) {
    const pw = input.passwordPin;
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      errors.password = 'Password must be at least 8 characters with a letter and a number.';
    }
  }

  if (input.role === 'REGULATOR') {
    errors.role = 'Regulator accounts are created by the Ministry and cannot be self-registered.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Creates a new UserAccount object
 */
export function buildUserAccount(
  input: CreateAccountInput,
  existingAccounts: UserAccount[] = []
): UserAccount {
  const validation = validateCreateAccount(input);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr || 'Invalid account details');
  }

  const rolePrefix = input.role.substring(0, 3).toLowerCase();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const id = `user-${rolePrefix}-${Date.now().toString(36)}-${randomSuffix}`;
  const now = new Date().toISOString();

  const colorIndex =
    (existingAccounts.length + Math.floor(Math.random() * 3)) % AVATAR_COLORS.length;

  return {
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    organization: input.organization.trim(),
    designation: input.designation?.trim() || getDefaultDesignation(input.role),
    phone: input.phone?.trim() || '+91 90000 00000',
    apaarId: input.apaarId?.trim() || undefined,
    avatarBg: AVATAR_COLORS[colorIndex],
    createdAt: now,
    lastActive: now,
    isDefault: false,
  };
}

export function getDefaultDesignation(role: UserRole): string {
  switch (role) {
    case 'STUDENT':
      return 'Student Candidate';
    case 'EMPLOYER':
      return 'Talent Acquisition & BGV Lead';
    case 'INSTITUTION':
      return 'Academic Registrar & NAD Officer';
    case 'REGULATOR':
      return 'MoE Regulatory Compliance Auditor';
    default:
      return 'Authorized Portal User';
  }
}

/**
 * Hydrates accounts from localStorage with fallback to default accounts
 */
export function loadUserAccounts(): UserAccount[] {
  if (typeof window === 'undefined') return DEFAULT_USER_ACCOUNTS;
  try {
    const raw = localStorage.getItem(USER_ACCOUNTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored user accounts', err);
  }
  return DEFAULT_USER_ACCOUNTS;
}

/**
 * Saves accounts array to localStorage
 */
export function persistUserAccounts(accounts: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Failed to persist user accounts', err);
  }
}

/**
 * Retrieves the active user from localStorage or defaults to the first account
 */
export function loadActiveUser(accounts: UserAccount[]): UserAccount {
  if (accounts.length === 0) return DEFAULT_USER_ACCOUNTS[0];
  if (typeof window === 'undefined') return accounts[0];

  try {
    const activeId = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    if (activeId) {
      const match = accounts.find(a => a.id === activeId);
      if (match) return match;
    }
  } catch (err) {
    console.warn('Failed to load active user ID', err);
  }
  return accounts[0];
}

/**
 * Persists the active user ID to localStorage
 */
export function persistActiveUserId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, id);
  } catch (err) {
    console.warn('Failed to save active user ID', err);
  }
}

export function loadAuthSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTH_SESSION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function persistAuthSession(isAuthenticated: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (isAuthenticated) {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to persist auth session state', err);
  }
}

export function loadStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistStoredSessionToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage error
  }
}
