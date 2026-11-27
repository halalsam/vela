import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { Auth } from './auth/auth';
import type { Database } from './db/client';
import type { Env } from './env';
import type { JobQueue } from './jobs/queue';
import type { Logger } from './logger';
import type { EsimProvider } from './integrations/esims/provider';
import type { PaymentProvider } from './integrations/payments/provider';
import type { SupportDesk } from './services/support.service';
import type { Storage } from './integrations/storage';

export type AppDeps = {
  db: Database;
  env: Env;
  logger: Logger;
  version: string;
  auth: Auth;
  payments: PaymentProvider;
  queue: JobQueue;
  support: SupportDesk;
  esimProvider?: EsimProvider;
  backupProvider?: EsimProvider | null;
  /** Image uploads. Built from the env when not passed in. */
  storage?: Storage;
};

export type SessionUser = { id: string; email: string; name: string; phoneNumber: string | null };

export type AppEnv = {
  Variables: {
    deps: AppDeps;
    logger: Logger;
    requestId: string;
    user: SessionUser;
  };
};

/** A controller function for one OpenAPI route definition. */
export type Handler<R extends RouteConfig> = RouteHandler<R, AppEnv>;
