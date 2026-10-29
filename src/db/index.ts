/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

/**
 * Connection settings, in order of preference:
 * 1. DATABASE_URL (e.g. postgresql://user:pass@host:5432/apaar_registry)
 * 2. SQL_HOST / SQL_PORT / SQL_DB_NAME / SQL_USER / SQL_PASSWORD
 */
export function getPoolConfig(): PoolConfig {
  const base: PoolConfig = { max: 10, connectionTimeoutMillis: 5000 };
  if (process.env.DATABASE_URL) {
    return { ...base, connectionString: process.env.DATABASE_URL };
  }
  return {
    ...base,
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : undefined,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  };
}

export function isDatabaseConfigured(): boolean {
  return !!(process.env.DATABASE_URL || (process.env.SQL_HOST && process.env.SQL_DB_NAME && process.env.SQL_USER));
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(getPoolConfig());
    global._postgresPool.on('error', err => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

let dbInstance: ReturnType<typeof drizzle>;
try {
  const pool = createPool();
  dbInstance = drizzle(pool, { schema });
} catch {
  console.warn('[AI Studio] Database pool initialization skipped — using in-memory store');
  dbInstance = {} as ReturnType<typeof drizzle>;
}

export const db = dbInstance;
