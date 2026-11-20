import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
import { schema } from '../src/db/client';
import { loadEnv } from '../src/env';

export const testKey = 'a'.repeat(64);

export const testEnv = loadEnv({
  NODE_ENV: 'test',
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://test@localhost/test',
  ENCRYPTION_KEY: testKey,
  LOG_LEVEL: 'silent',
});

export const silentLogger = pino({ level: 'silent' });

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../src/db/migrations', import.meta.url)) });
  return { db, client };
}
