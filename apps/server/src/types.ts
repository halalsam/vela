import type { Auth } from './auth/auth';
import type { Database } from './db/client';
import type { Env } from './env';
import type { Logger } from './logger';

export type AppDeps = {
  db: Database;
  env: Env;
  logger: Logger;
  version: string;
  auth: Auth;
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
