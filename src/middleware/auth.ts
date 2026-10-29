/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../server/security.ts';
import { getUserByUid, DbUser } from '../db/databaseService.ts';
import type { Caller } from '../server/accessRules.ts';

export interface AuthRequest extends Request {
  user?: Caller;
  dbUser?: DbUser;
}

export function callerFromDbUser(u: DbUser): Caller {
  return {
    uid: u.uid,
    role: u.role,
    email: u.email,
    name: u.name,
    organization: u.organization,
    apaarId: u.apaarId,
    institutionApproved: u.institutionApproved,
  };
}

/** Resolves a session token to the user's current database record (or null). */
export async function resolveSessionToken(token: string | undefined | null): Promise<DbUser | null> {
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session) return null;
  return getUserByUid(session.uid);
}

/**
 * Requires a valid server-issued session token (`Authorization: Bearer apaar_st...`).
 * The caller's role, organization and APAAR ID come from the database, never from the token
 * or the request body. Google / Firebase users first exchange their Firebase ID token for a
 * session token at POST /api/auth/firebase.
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing session token' });
  }
  try {
    const user = await resolveSessionToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: invalid or expired session' });
    }
    req.dbUser = user;
    req.user = callerFromDbUser(user);
    return next();
  } catch (err) {
    console.error('Auth check failed:', err);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
};
