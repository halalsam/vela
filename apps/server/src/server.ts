import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';
import { createLogger } from './logger';
import { flushSentry, initSentry } from './sentry';
import { version } from './version';

const env = loadEnv();
const logger = createLogger(env);
initSentry(env, 'api');
const { db, pool } = createDb(env.DATABASE_URL);
const app = createApp({ db, env, logger, version });

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  logger.info({ port: info.port, env: env.APP_ENV, sha: env.GIT_SHA }, 'api listening');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await pool.end();
  await flushSentry();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
