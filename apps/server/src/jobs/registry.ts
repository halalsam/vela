import type { JobWithMetadata, PgBoss } from 'pg-boss';
import type { Database } from '../db/client';
import type { Env } from '../env';
import type { Logger } from '../logger';
import { refreshRates } from '../modules/catalog/fx';
import { syncCatalog } from '../modules/catalog/sync';
import type { EsimProvider } from '../modules/esims/provider';
import { queueTrackedEsims, syncEsimUsage } from '../modules/esims/usage';
import type { EmailSender } from '../modules/notifications/email';
import type { PushSender } from '../modules/notifications/push';
import { sendBroadcast, type BroadcastJob } from '../modules/crm/broadcasts';
import type { SupportReplyJob } from '../modules/crm/inbox';
import { supportReplyMessage } from '../modules/notifications/messages';
import { notifyUser } from '../modules/notifications/notify';
import { provisionOrder, refundOrder } from '../modules/orders/fulfil';
import { expireStaleOrders } from '../modules/orders/service';
import type { PaymentProvider } from '../modules/payments/provider';
import { JOB, type EsimJob, type JobQueue, type OrderJob } from './queue';

export type JobContext = {
  logger: Logger;
  db: Database;
  env: Env;
  provider: EsimProvider;
  backupProvider: EsimProvider | null;
  payments: PaymentProvider;
  queue: JobQueue;
  push: PushSender;
  email: EmailSender;
};

export type JobDefinition<T extends object = object> = {
  name: string;
  schedule?: string;
  retryLimit?: number;
  batchSize?: number;
  handle: (jobs: JobWithMetadata<T>[], context: JobContext) => Promise<void>;
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
  handle: async (_jobs, { db, env, provider, backupProvider, logger }) => {
    await syncCatalog(db, provider, { marginPercent: env.PRICING_MARGIN_PERCENT, logger, backup: backupProvider });
  },
};

export const provisionJob: JobDefinition<OrderJob> = {
  name: JOB.provision,
  retryLimit: 3,
  handle: async (jobs, context) => {
    for (const job of jobs) {
      await provisionOrder(context, job.data.orderId, { finalAttempt: job.retryCount >= job.retryLimit });
    }
  },
};

export const refundJob: JobDefinition<OrderJob> = {
  name: JOB.refund,
  retryLimit: 5,
  handle: async (jobs, context) => {
    for (const job of jobs) {
      await refundOrder(context, job.data.orderId);
    }
  },
};

export const expireOrdersJob: JobDefinition = {
  name: JOB.expireOrders,
  schedule: '*/5 * * * *',
  retryLimit: 1,
  handle: async (_jobs, { db, logger }) => {
    const expired = await expireStaleOrders(db);
    if (expired > 0) logger.info({ expired }, 'unpaid orders expired');
  },
};

export const usageJob: JobDefinition = {
  name: JOB.usage,
  schedule: '*/15 * * * *',
  retryLimit: 0,
  handle: async (_jobs, context) => {
    const queued = await queueTrackedEsims(context.db, context.queue, { limit: 20_000 });
    context.logger.info({ queued }, 'usage checks queued');
  },
};

export const usageOneJob: JobDefinition<EsimJob> = {
  name: JOB.usageOne,
  retryLimit: 2,
  batchSize: 5,
  handle: async (jobs, context) => {
    for (const job of jobs) {
      await syncEsimUsage(context, job.data.esimId);
    }
  },
};

export const fxJob: JobDefinition = {
  name: JOB.fx,
  schedule: '30 16 * * 1-5',
  retryLimit: 3,
  handle: async (_jobs, { db, logger }) => {
    await refreshRates(db, logger);
  },
};

export const supportReplyJob: JobDefinition<SupportReplyJob> = {
  name: JOB.supportReply,
  retryLimit: 2,
  handle: async (jobs, context) => {
    for (const job of jobs) {
      const sent = await notifyUser(context, job.data.userId, (locale) => supportReplyMessage(locale, job.data.text), {
        kind: 'support',
        ...(job.data.conversationId ? { conversation_id: job.data.conversationId } : {}),
      });
      context.logger.info({ userId: job.data.userId, sent }, 'support reply push');
    }
  },
};

// No retries: a retry after a partial send would push the same message twice.
export const broadcastJob: JobDefinition<BroadcastJob> = {
  name: JOB.broadcast,
  retryLimit: 0,
  handle: async (jobs, context) => {
    for (const job of jobs) await sendBroadcast(context, job.data.broadcastId);
  },
};

export const jobs = [heartbeat, catalogSync, provisionJob, refundJob, expireOrdersJob, usageJob, usageOneJob, fxJob, supportReplyJob, broadcastJob] as JobDefinition[];

export async function ensureQueue(boss: PgBoss, definition: Pick<JobDefinition, 'name' | 'retryLimit'>) {
  if (await boss.getQueue(definition.name)) return;
  await boss.createQueue(definition.name, { retryLimit: definition.retryLimit ?? 3, retryBackoff: true });
}

export async function registerJobs(boss: PgBoss, definitions: JobDefinition[], context: JobContext) {
  for (const definition of definitions) {
    await ensureQueue(boss, definition);
    await boss.work(definition.name, { includeMetadata: true, batchSize: definition.batchSize ?? 1 }, async (batch: JobWithMetadata<object>[]) => {
      const logger = context.logger.child({ job: definition.name });
      await definition.handle(batch, { ...context, logger });
    });
    if (definition.schedule) await boss.schedule(definition.name, definition.schedule, null, { tz: 'UTC' });
  }
}
