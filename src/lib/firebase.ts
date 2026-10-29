/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount } from '../types/auth';
import { AcademicCredential } from '../types';
import { ensureVaultUri } from '../utils/vaultEngine';


// Prevent internal @firebase/firestore WebChannel probe/reconnect messages from triggering console.error overlays
setLogLevel('silent');

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

try {
  initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  // Firestore instance already initialized
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot with automatic long-polling retry
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (retryError) {
        if (retryError instanceof Error && retryError.message.includes('the client is offline')) {
          console.warn('Firestore client is currently operating in offline mode.');
        }
      }
    }
  }
}
testConnection();

/**
 * Syncs an authenticated Firebase User profile into Firestore /users/{uid}
 */
export async function syncUserProfileToFirestore(account: UserAccount): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const path = `users/${currentUser.uid}`;
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const existingSnap = await getDocFromServer(userRef);

    const safeName = (account.name || 'Portal User').slice(0, 120);
    const safeEmail = (currentUser.email || account.email || 'user@apaar.gov.in').slice(0, 160);
    const safeOrg = (account.organization || 'National Academic Depository').slice(0, 160);
    // REGULATOR can only be assigned by an admin (enforced by firestore.rules), never from the browser.
    const safeRole = account.role === 'REGULATOR' ? 'STUDENT' : account.role;

    const payload: Record<string, unknown> = {
      uid: currentUser.uid,
      name: safeName.length >= 2 ? safeName : 'Portal User',
      email: safeEmail,
      role: safeRole,
      organization: safeOrg.length >= 2 ? safeOrg : 'NAD Institution',
      updatedAt: serverTimestamp(),
    };

    if (account.apaarId && account.apaarId.length >= 12 && account.apaarId.length <= 20) {
      payload.apaarId = account.apaarId;
    }

    if (!existingSnap.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(userRef, payload);
    } else {
      const existingData = existingSnap.data();
      await setDoc(userRef, {
        ...payload,
        uid: existingData.uid,
        role: existingData.role,
        createdAt: existingData.createdAt,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Records an immutable session audit log in Firestore /sessionLogs/{logId} when signed in with Firebase Auth
 */
export async function recordFirestoreSessionLog(entry: {
  id: string;
  actor: string;
  action: string;
  targetApaarId: string;
  details: string;
  status: 'SUCCESS' | 'INFO' | 'ALERT';
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || `log-${Date.now()}`;
  const path = `sessionLogs/${cleanId}`;
  try {
    await setDoc(doc(db, 'sessionLogs', cleanId), {
      ownerId: currentUser.uid,
      actor: (entry.actor || 'System').slice(0, 160),
      action: (entry.action || 'PORTAL_EVENT').slice(0, 80),
      targetApaarId: (entry.targetApaarId || 'SYSTEM').slice(0, 64),
      details: (entry.details || 'Session event recorded').slice(0, 600),
      status: entry.status,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Syncs a sealed APAAR Vault credential into Firestore /vaultCredentials/{credentialId}
 * when signed in with Firebase Auth.
 */
export async function syncVaultCredentialToFirestore(
  credential: AcademicCredential,
  studentApaarId: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = credential.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || `CRED-${Date.now()}`;
  const path = `vaultCredentials/${cleanId}`;
  try {
    const vaultUri = ensureVaultUri(credential.digilockerUri, studentApaarId, cleanId, credential.type).slice(0, 300);
    const payload: Record<string, unknown> = {
      credentialId: cleanId,
      ownerId: currentUser.uid,
      studentApaarId: studentApaarId.slice(0, 20),
      type: credential.type,
      title: (credential.title || 'Academic Credential').slice(0, 200),
      issuingInstitution: (credential.issuingInstitution || 'APAAR Registry Institution').slice(0, 200),
      cgpaOrPercentage: (credential.cgpaOrPercentage || 'Verified').slice(0, 80),
      vaultUri,
      sha256Hash: (credential.sha256Hash || '0000000000000000').slice(0, 128),
      digitalSignature: (credential.digitalSignature || '0000000000000000').slice(0, 256),
      createdAt: serverTimestamp(),
    };
    if (credential.documentFileName && credential.documentFileName.length >= 1) {
      payload.documentFileName = credential.documentFileName.slice(0, 180);
    }
    if (credential.documentFileSha256 && credential.documentFileSha256.length >= 16) {
      payload.documentFileSha256 = credential.documentFileSha256.slice(0, 128);
    }
    await setDoc(doc(db, 'vaultCredentials', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export { collection, query, where, onSnapshot, firebaseConfig };

