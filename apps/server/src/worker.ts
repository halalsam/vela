import { PgBoss } from 'pg-boss';
import { loadEnv } from './env';
import { jobs, registerJobs } from './jobs/registry';
import { createLogger } from './logger';
import { captureError, flushSentry, initSentry } from './sentry';

const env = loadEnv();
const logger = createLogger(env).child({ process: 'worker' });
initSentry(env, 'worker');

const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
boss.on('error', (error) => {
  captureError(error);
  logger.error({ err: error }, 'pg-boss error');
});

await boss.start();
await registerJobs(boss, jobs, { logger });
logger.info({ jobs: jobs.map((job) => job.name) }, 'worker started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker stopping');
  await boss.stop({ graceful: true, timeout: 20_000 });
  await flushSentry();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
