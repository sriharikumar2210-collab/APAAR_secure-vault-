/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'STUDENT' | 'EMPLOYER' | 'INSTITUTION' | 'REGULATOR';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  designation?: string;
  phone?: string;
  apaarId?: string; // Bound to student registry if role is STUDENT
  avatarBg?: string;
  createdAt: string;
  lastActive: string;
  isDefault?: boolean;
  institutionApproved?: boolean;
}

export interface CreateAccountInput {
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  designation?: string;
  phone?: string;
  apaarId?: string;
  passwordPin?: string;
}
