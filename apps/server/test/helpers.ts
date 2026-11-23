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
import { memoryQueue } from '../src/jobs/queue';
import { createMockPayments } from '../src/modules/payments/mock';
import type { PaymentProvider } from '../src/modules/payments/provider';
import { createSupportDesk, type SupportDesk } from '../src/modules/support/support';

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

export function createTestApp(db: Database, overrides: { payments?: PaymentProvider; support?: SupportDesk } = {}) {
  const sms = createMemorySms();
  const queue = memoryQueue();
  const payments = overrides.payments ?? createMockPayments();
  const auth = createAuth({ db, env: testEnv, logger: silentLogger, sms });
  const support = overrides.support ?? createSupportDesk(testEnv, db, silentLogger);
  const app = createApp({ db, env: testEnv, logger: silentLogger, version: 'test', auth, payments, queue, support });
  return { app, auth, sms, queue, payments };
}

export async function signInWithPhone(harness: ReturnType<typeof createTestApp>, phoneNumber: string): Promise<string> {
  const post = (path: string, body: unknown) =>
    harness.app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    });
  await post('/v1/auth/phone-number/send-otp', { phoneNumber });
  const code = harness.sms.sent.findLast((item) => item.phoneNumber === phoneNumber)?.code;
  const verified = await post('/v1/auth/phone-number/verify', { phoneNumber, code });
  const token = verified.headers.get('set-auth-token');
  if (!token) throw new Error(`Sign-in failed with ${verified.status}`);
  return token;
}
