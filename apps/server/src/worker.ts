import { sql } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import { createDb } from './db/client';
import { plan } from './db/schema';
import { loadEnv } from './env';
import { catalogSync, jobs, registerJobs } from './jobs/registry';
import { createLogger } from './logger';
import { createEsimProvider } from './modules/esims/providers';
import { captureError, flushSentry, initSentry } from './sentry';

const env = loadEnv();
const logger = createLogger(env).child({ process: 'worker' });
initSentry(env, 'worker');

const { db, pool } = createDb(env.DATABASE_URL);
const provider = createEsimProvider(env);
const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
boss.on('error', (error) => {
  captureError(error);
  logger.error({ err: error }, 'pg-boss error');
});

await boss.start();
await registerJobs(boss, jobs, { logger, db, env, provider });
logger.info({ jobs: jobs.map((job) => job.name), provider: provider.name }, 'worker started');

const [{ count } = { count: 0 }] = await db.select({ count: sql<number>`count(*)::int` }).from(plan);
if (count === 0) {
  await boss.send(catalogSync.name, {}, { singletonKey: 'initial' });
  logger.info('catalog empty, initial sync queued');
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker stopping');
  await boss.stop({ graceful: true, timeout: 20_000 });
  await pool.end();
  await flushSentry();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
