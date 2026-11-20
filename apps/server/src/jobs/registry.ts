import type { Job, PgBoss } from 'pg-boss';
import type { Logger } from '../logger';

export type JobContext = { logger: Logger };

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

export const jobs: JobDefinition[] = [heartbeat];

export async function registerJobs(boss: PgBoss, definitions: JobDefinition[], context: JobContext) {
  for (const definition of definitions) {
    await boss.createQueue(definition.name, { retryLimit: definition.retryLimit ?? 3, retryBackoff: true });
    await boss.work(definition.name, async (batch: Job<object>[]) => {
      const logger = context.logger.child({ job: definition.name });
      await definition.handle(batch, { logger });
    });
    if (definition.schedule) await boss.schedule(definition.name, definition.schedule, null, { tz: 'UTC' });
  }
}
