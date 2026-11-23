import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { seedReferenceData } from './modules/catalog/seed';
import { createLogger } from './logger';

const env = loadEnv();
const logger = createLogger(env);
const { db, pool } = createDb(env.DATABASE_URL);
const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('./migrations', import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  logger.info({ migrationsFolder }, 'migrations applied');
  await seedReferenceData(db, { sampleContent: env.APP_ENV !== 'production' });
  logger.info('reference data seeded');
} catch (error) {
  logger.error({ err: error }, 'migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
