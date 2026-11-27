import type { Auth } from './auth/auth';
import type { Database } from './db/client';
import type { Env } from './env';
import type { JobQueue } from './jobs/queue';
import type { Logger } from './logger';
import type { EsimProvider } from './modules/esims/provider';
import type { PaymentProvider } from './modules/payments/provider';
import type { SupportDesk } from './modules/support/support';
import type { Storage } from './modules/uploads/storage';

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
