import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { auditLog, broadcast, profile } from '../../db/schema';
import { JOB, type JobQueue } from '../../jobs/queue';
import type { Logger } from '../../logger';
import { notifyUser, type NotifyDeps } from '../notifications/notify';
import { audienceSize, reachableIds, type CustomerFilter } from './customers';

export type BroadcastJob = { broadcastId: string };

export type BroadcastInput = {
  title: string;
  body: string;
  title_ar: string | null;
  body_ar: string | null;
  segment: CustomerFilter;
};

function out(row: typeof broadcast.$inferSelect, names: Map<string, string>) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    title_ar: row.titleAr,
    body_ar: row.bodyAr,
    segment: row.segment as CustomerFilter,
    status: row.status,
    audience: row.audience,
    reached: row.reached,
    created_by: names.get(row.createdBy) ?? 'Staff',
    created_at: row.createdAt.toISOString(),
    sent_at: row.sentAt?.toISOString() ?? null,
    error: row.error,
  };
}

export async function listBroadcasts(db: Database) {
  const rows = await db.select({ broadcast, name: profile.name }).from(broadcast).leftJoin(profile, eq(profile.userId, broadcast.createdBy)).orderBy(desc(broadcast.createdAt)).limit(100);
  const names = new Map(rows.map((row) => [row.broadcast.createdBy, row.name ?? 'Staff']));
  return rows.map((row) => out(row.broadcast, names));
}

export async function createBroadcast(deps: { db: Database; queue: JobQueue }, actorId: string, input: BroadcastInput) {
  const size = await audienceSize(deps.db, input.segment);
  const [row] = await deps.db
    .insert(broadcast)
    .values({
      title: input.title,
      body: input.body,
      titleAr: input.title_ar,
      bodyAr: input.body_ar,
      segment: input.segment,
      audience: size.reachable,
      createdBy: actorId,
    })
    .returning();
  if (!row) throw new Error('Broadcast was not stored');
  await deps.db.insert(auditLog).values({ actorId, action: 'broadcast.create', target: `broadcast:${row.id}`, data: { ...input, audience: size.reachable } });
  const job: BroadcastJob = { broadcastId: row.id };
  await deps.queue.send(JOB.broadcast, job, { singletonKey: row.id });
  return out(row, new Map());
}

const PAGE = 500;

/** Sends a queued broadcast as pushes. Safe to retry: it only runs from "queued" or a failed "sending". */
export async function sendBroadcast(deps: NotifyDeps & { logger: Logger }, broadcastId: string) {
  const [row] = await deps.db.select().from(broadcast).where(eq(broadcast.id, broadcastId));
  if (!row || row.status === 'sent') return;
  await deps.db.update(broadcast).set({ status: 'sending', reached: 0, error: null }).where(eq(broadcast.id, broadcastId));
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
      await deps.db.update(broadcast).set({ reached }).where(eq(broadcast.id, broadcastId));
    }
    await deps.db.update(broadcast).set({ status: 'sent', reached, sentAt: new Date() }).where(eq(broadcast.id, broadcastId));
    deps.logger.info({ broadcastId, reached }, 'broadcast sent');
  } catch (error) {
    await deps.db
      .update(broadcast)
      .set({ status: 'failed', reached, error: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error' })
      .where(eq(broadcast.id, broadcastId));
    throw error;
  }
}
