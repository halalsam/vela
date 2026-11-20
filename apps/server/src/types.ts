import type { Database } from './db/client';
import type { Env } from './env';
import type { Logger } from './logger';

export type AppDeps = {
  db: Database;
  env: Env;
  logger: Logger;
  version: string;
};

export type AppEnv = {
  Variables: {
    deps: AppDeps;
    logger: Logger;
    requestId: string;
  };
};
