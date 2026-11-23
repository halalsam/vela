import { serve } from '@hono/node-server';
import { PgBoss } from 'pg-boss';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { createSmsSender } from './auth/sms';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { bossQueue } from './jobs/queue';
import { ensureQueue, provisionJob } from './jobs/registry';
import { createLogger } from './logger';
import { createPaymentProvider } from './modules/payments';
import { createSupportDesk } from './modules/support/support';
import { captureError, flushSentry, initSentry } from './sentry';
import { version } from './version';

const env = loadEnv();
const logger = createLogger(env);
initSentry(env, 'api');
const { db, pool } = createDb(env.DATABASE_URL);
const auth = createAuth({ db, env, logger, sms: createSmsSender(env, logger) });
const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss', supervise: false, schedule: false });
boss.on('error', (error) => {
  captureError(error);
  logger.error({ err: error }, 'pg-boss error');
});
await boss.start();
await ensureQueue(boss, provisionJob);
const payments = createPaymentProvider(env);
const support = createSupportDesk(env, db, logger);
const app = createApp({ db, env, logger, version, auth, payments, queue: bossQueue(boss), support });

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  logger.info({ port: info.port, env: env.APP_ENV, sha: env.GIT_SHA, payments: payments.name }, 'api listening');
  if (support.name === 'local') logger.warn('Chatwoot is not configured: support messages are stored locally');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await boss.stop({ graceful: true, timeout: 10_000 });
  await pool.end();
  await flushSentry();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
