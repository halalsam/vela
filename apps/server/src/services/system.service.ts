import type { Database } from '../db/client';
import type { Logger } from '../logger';
import { ping } from '../models/system.model';

export async function databaseIsUp(db: Database, logger: Logger): Promise<boolean> {
  try {
    await ping(db);
    return true;
  } catch (error) {
    logger.error({ err: error }, 'readiness check failed');
    return false;
  }
}
