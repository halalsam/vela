import type { Database } from '../db/client';
import { JOB, type JobQueue } from '../jobs/queue';
import type { Logger } from '../logger';
import * as audits from '../models/audit.model';
import * as broadcasts from '../models/broadcast.model';
import { broadcastView } from '../views/broadcast.view';
import { audienceSize, reachableIds, type CustomerFilter } from './customers.service';
import { notifyUser, type NotifyDeps } from './notify.service';

export type BroadcastJob = { broadcastId: string };

export type BroadcastInput = {
  title: string;
  body: string;
  title_ar: string | null;
  body_ar: string | null;
  segment: CustomerFilter;
};

const LIST_LIMIT = 100;
const PAGE = 500;

export async function listBroadcasts(db: Database) {
  const rows = await broadcasts.recentBroadcasts(db, LIST_LIMIT);
  const names = new Map(rows.map((row) => [row.broadcast.createdBy, row.name ?? 'Staff']));
  return rows.map((row) => broadcastView(row.broadcast, names));
}

export async function createBroadcast(deps: { db: Database; queue: JobQueue }, actorId: string, input: BroadcastInput) {
  const size = await audienceSize(deps.db, input.segment);
  const row = await broadcasts.insertBroadcast(deps.db, {
    title: input.title,
    body: input.body,
    titleAr: input.title_ar,
    bodyAr: input.body_ar,
    segment: input.segment,
    audience: size.reachable,
    createdBy: actorId,
  });
  await audits.audit(deps.db, actorId, 'broadcast.create', `broadcast:${row.id}`, { ...input, audience: size.reachable });
  const job: BroadcastJob = { broadcastId: row.id };
  await deps.queue.send(JOB.broadcast, job, { singletonKey: row.id });
  return broadcastView(row, new Map());
}

/** Sends a queued broadcast as pushes. Safe to retry: it only runs from "queued" or a failed "sending". */
export async function sendBroadcast(deps: NotifyDeps & { logger: Logger }, broadcastId: string) {
  const row = await broadcasts.findBroadcast(deps.db, broadcastId);
  if (!row || row.status === 'sent') return;
  await broadcasts.updateBroadcast(deps.db, broadcastId, { status: 'sending', reached: 0, error: null });
  const segment = row.segment as CustomerFilter;
  const message = (locale: 'en' | 'ar') =>
    locale === 'ar' && row.titleAr && row.bodyAr ? { title: row.titleAr, body: row.bodyAr } : { title: row.title, body: row.body };
  let reached = 0;
  let after: string | null = null;
  try {
    for (;;) {
      const ids = await reachableIds(deps.db, segment, after, PAGE);
      for (const userId of ids) {
        const sent = await notifyUser(deps, userId, message, { kind: 'broadcast', broadcast_id: row.id });
        if (sent > 0) reached += 1;
      }
      if (ids.length < PAGE) break;
      after = ids[ids.length - 1] ?? null;
      await broadcasts.updateBroadcast(deps.db, broadcastId, { reached });
    }
    await broadcasts.updateBroadcast(deps.db, broadcastId, { status: 'sent', reached, sentAt: new Date() });
    deps.logger.info({ broadcastId, reached }, 'broadcast sent');
  } catch (error) {
    await broadcasts.updateBroadcast(deps.db, broadcastId, {
      status: 'failed',
      reached,
      error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error',
    });
    throw error;
  }
}
