import type { Job, PgBoss } from 'pg-boss';
import type { Database } from '../db/client';
import type { Env } from '../env';
import type { Logger } from '../logger';
import { syncCatalog } from '../modules/catalog/sync';
import type { EsimProvider } from '../modules/esims/provider';

export type JobContext = { logger: Logger; db: Database; env: Env; provider: EsimProvider };

export type JobDefinition<T extends object = object> = {
  name: string;
  schedule?: string;
  retryLimit?: number;
  handle: (jobs: Job<T>[], context: JobContext) => Promise<void>;
};

export const heartbeat: JobDefinition = {
  name: 'system.heartbeat',
  schedule: '*/5 * * * *',
  retryLimit: 0,
  handle: async (jobs, { logger }) => {
    logger.debug({ count: jobs.length }, 'worker heartbeat');
  },
};

export const catalogSync: JobDefinition = {
  name: 'catalog.sync',
  schedule: '0 */6 * * *',
  retryLimit: 3,
  handle: async (_jobs, { db, env, provider, logger }) => {
    await syncCatalog(db, provider, { marginPercent: env.PRICING_MARGIN_PERCENT, logger });
  },
};

export const jobs: JobDefinition[] = [heartbeat, catalogSync];

export async function registerJobs(boss: PgBoss, definitions: JobDefinition[], context: JobContext) {
  for (const definition of definitions) {
    await boss.createQueue(definition.name, { retryLimit: definition.retryLimit ?? 3, retryBackoff: true });
    await boss.work(definition.name, async (batch: Job<object>[]) => {
      const logger = context.logger.child({ job: definition.name });
      await definition.handle(batch, { ...context, logger });
    });
    if (definition.schedule) await boss.schedule(definition.name, definition.schedule, null, { tz: 'UTC' });
  }
}
