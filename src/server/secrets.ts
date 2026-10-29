/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Server secrets.
 *
 * - SESSION_SECRET signs login tokens.
 * - CREDENTIAL_SIGNING_SECRET signs academic credentials issued by institutions.
 *
 * In production both MUST be set as environment variables, otherwise the server refuses to start.
 * In development, if they are missing, random secrets are generated once and kept in
 * `.secrets.local.json` (git-ignored) so tokens and signatures survive restarts.
 * There is no hard-coded fallback secret anywhere in the code.
 */

const isProd = process.env.NODE_ENV === 'production';
const LOCAL_SECRETS_FILE = path.resolve(process.cwd(), '.secrets.local.json');

type SecretName = 'SESSION_SECRET' | 'CREDENTIAL_SIGNING_SECRET';

let localCache: Partial<Record<SecretName, string>> | null = null;

function loadLocalSecrets(): Partial<Record<SecretName, string>> {
  if (localCache) return localCache;
  try {
    localCache = JSON.parse(fs.readFileSync(LOCAL_SECRETS_FILE, 'utf8'));
  } catch {
    localCache = {};
  }
  return localCache!;
}

function saveLocalSecrets(values: Partial<Record<SecretName, string>>) {
  try {
    fs.writeFileSync(LOCAL_SECRETS_FILE, JSON.stringify(values, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('[secrets] Could not write .secrets.local.json; secrets will reset on restart.', err);
  }
}

const PLACEHOLDER_PATTERN = /^(replace-with|your_|changeme)/i;

export function getSecret(name: SecretName): string {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.length >= 32 && !PLACEHOLDER_PATTERN.test(fromEnv)) {
    return fromEnv;
  }

  if (isProd) {
    throw new Error(
      `${name} is missing, too short (min 32 characters) or still the placeholder value. ` +
        `Set it in the environment before starting the server in production.`
    );
  }

  const local = loadLocalSecrets();
  if (!local[name]) {
    local[name] = crypto.randomBytes(32).toString('hex');
    saveLocalSecrets(local);
    console.warn(`[secrets] ${name} not set; generated a random development secret in .secrets.local.json`);
  }
  return local[name]!;
}

/** Call once at startup so a missing production secret stops the server immediately. */
export function assertSecretsConfigured(): void {
  getSecret('SESSION_SECRET');
  getSecret('CREDENTIAL_SIGNING_SECRET');
}
