import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
import { createApp } from '../src/app';
import { createAuth } from '../src/auth/auth';
import { createMemorySms } from '../src/auth/sms';
import { schema, type Database } from '../src/db/client';
import { loadEnv } from '../src/env';

export const testKey = 'a'.repeat(64);

export const testEnv = loadEnv({
  NODE_ENV: 'test',
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://test@localhost/test',
  ENCRYPTION_KEY: testKey,
  LOG_LEVEL: 'silent',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  CORS_ORIGINS: 'http://localhost:3000',
});

export const silentLogger = pino({ level: 'silent' });

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../src/db/migrations', import.meta.url)) });
  return { db, client };
}

export function createTestApp(db: Database) {
  const sms = createMemorySms();
  const auth = createAuth({ db, env: testEnv, logger: silentLogger, sms });
  const app = createApp({ db, env: testEnv, logger: silentLogger, version: 'test', auth });
  return { app, auth, sms };
}
