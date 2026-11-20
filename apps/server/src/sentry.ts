import * as Sentry from '@sentry/node';
import type { Env } from './env';

let enabled = false;

export function initSentry(env: Pick<Env, 'SENTRY_DSN' | 'APP_ENV' | 'GIT_SHA'>, serverName: string) {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    release: env.GIT_SHA,
    serverName,
    tracesSampleRate: env.APP_ENV === 'production' ? 0.1 : 1,
  });
  enabled = true;
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export async function flushSentry() {
  if (enabled) await Sentry.flush(2000);
}
