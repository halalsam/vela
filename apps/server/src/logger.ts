import { pino, type Logger } from 'pino';
import type { Env } from './env';

export type { Logger };

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV' | 'APP_ENV'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { env: env.APP_ENV },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.lpa', '*.activationCode', '*.password', '*.otp'],
      censor: '[redacted]',
    },
    transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  });
}
