import { PgBoss } from 'pg-boss';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { catalogSync, jobs, registerJobs } from './jobs/registry';
import { createLogger } from './logger';
import { countPlans } from './models/catalog.model';
import { refreshRates } from './services/fx.service';
import { createBackupProvider, createEsimProvider } from './integrations/esims';
import { createEmailSender } from './integrations/email';
import { createPushSender } from './integrations/push';
import { createPaymentProvider } from './integrations/payments';
import { bossQueue } from './jobs/queue';
import { captureError, flushSentry, initSentry } from './sentry';

const env = loadEnv();
const logger = createLogger(env).child({ process: 'worker' });
initSentry(env, 'worker');

const { db, pool } = createDb(env.DATABASE_URL);
const provider = createEsimProvider(env);
const backupProvider = createBackupProvider(env);
const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
boss.on('error', (error) => {
  captureError(error);
  logger.error({ err: error }, 'pg-boss error');
});

await boss.start();
const push = createPushSender(env, logger);
if (env.PUSH_ROUTE !== 'live') logger.warn('push route is console: notifications are logged, not sent');
await registerJobs(boss, jobs, { logger, db, env, provider, backupProvider, payments: createPaymentProvider(env), queue: bossQueue(boss), push, email: createEmailSender(env, logger) });
logger.info({ jobs: jobs.map((job) => job.name), provider: provider.name, backup: backupProvider?.name ?? null }, 'worker started');

const count = await countPlans(db);
try {
  await refreshRates(db, logger);
} catch (error) {
  logger.warn({ err: error }, 'exchange rates could not be refreshed at start; using stored rates');
}

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
