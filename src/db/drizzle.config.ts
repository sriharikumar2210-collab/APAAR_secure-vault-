/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

// Uses DATABASE_URL if set, otherwise the SQL_* settings (admin user for schema changes).
const url = process.env.DATABASE_URL;
const host = process.env.SQL_HOST;
const database = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

if (!url && (!host || !database || !user || !password)) {
  throw new Error('Set DATABASE_URL, or SQL_HOST, SQL_DB_NAME and SQL_ADMIN_USER / SQL_ADMIN_PASSWORD, in .env.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: url
    ? { url }
    : {
        host: host!,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        user: user!,
        password: password!,
        database: database!,
        ssl: false,
      },
  verbose: true,
});
