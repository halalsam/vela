import type { DailyUsage } from '@vela/api';
import { isLowData } from '@vela/utils';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { esim, order, plan, topUpPack, usageSnapshot } from '../../db/schema';
import { notFound } from '../../lib/errors';
import type { Logger } from '../../logger';
import type { NoticeKind } from '../notifications/messages';
import { pushLiveActivities, sendNotice } from '../notifications/notify';
import type { PushSender } from '../notifications/push';
import { creditReferrerForEsim } from '../rewards/credit';
import { JOB, type JobQueue } from '../../jobs/queue';
import type { EsimProvider } from './provider';
import { providerFor } from './providers';

export type UsageDeps = { db: Database; logger: Logger; provider: EsimProvider; backupProvider?: EsimProvider | null; push: PushSender; now?: () => Date };

type EsimRow = typeof esim.$inferSelect;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DAILY_DAYS = 7;

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function noticesDue(row: Pick<EsimRow, 'status' | 'dataUsedMb' | 'dataTotalMb' | 'expiresAt'>, validityDays: number, now: Date): NoticeKind[] {
  if (row.status === 'depleted') return ['depleted'];
  if (row.status !== 'active') return [];
  const due: NoticeKind[] = [];
  if (isLowData(row.dataUsedMb, row.dataTotalMb)) due.push('low_data');
  if (row.expiresAt) {
    const remaining = row.expiresAt.getTime() - now.getTime();
    if (remaining > 0 && remaining <= 2 * HOUR_MS) due.push('expiry_2h');
    else if (remaining > 2 * HOUR_MS && remaining <= DAY_MS && validityDays >= 3) due.push('expiry_24h');
  }
  return due;
}

export async function syncEsimUsage(deps: UsageDeps, esimId: string): Promise<{ changed: boolean; notices: NoticeKind[] }> {
  const { db } = deps;
  const now = deps.now?.() ?? new Date();
  const [found] = await db
    .select({ esim, validityDays: plan.validityDays, planMb: plan.dataMb })
    .from(esim)
    .innerJoin(plan, eq(plan.id, esim.planId))
    .where(eq(esim.id, esimId));
  if (!found) return { changed: false, notices: [] };
  const before = found.esim;
  const [extra] = await db
    .select({ days: sql<number>`coalesce(sum(${topUpPack.extraDays}), 0)::int` })
    .from(order)
    .innerJoin(topUpPack, eq(topUpPack.id, order.topUpPackId))
    .where(and(eq(order.esimId, before.id), eq(order.kind, 'top_up'), eq(order.status, 'fulfilled')));
  const usage = await providerFor(deps.provider, deps.backupProvider, before.provider).usage({
    iccid: before.iccid,
    providerRef: before.providerRef,
    purchasedAt: before.createdAt,
    planMb: found.planMb,
    totalMb: before.dataTotalMb,
    validityDays: found.validityDays,
    extraDays: extra?.days ?? 0,
  });
  const changed =
    usage.usedMb !== before.dataUsedMb ||
    usage.totalMb !== before.dataTotalMb ||
    usage.status !== before.status ||
    (usage.expiresAt?.getTime() ?? null) !== (before.expiresAt?.getTime() ?? null);

  const [after] = await db
    .update(esim)
    .set({
      dataUsedMb: usage.usedMb,
      dataTotalMb: usage.totalMb,
      status: usage.status,
      activatedAt: usage.activatedAt ?? before.activatedAt,
      expiresAt: usage.expiresAt ?? before.expiresAt,
      usageSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(esim.id, before.id))
    .returning();
  if (!after) return { changed: false, notices: [] };

  if (usage.status !== 'not_started') {
    await db
      .insert(usageSnapshot)
      .values({ esimId: after.id, day: utcDay(now), usedMb: usage.usedMb })
      .onConflictDoUpdate({ target: [usageSnapshot.esimId, usageSnapshot.day], set: { usedMb: sql`excluded.used_mb` } });
  }

  if (before.status === 'not_started' && after.status !== 'not_started') {
    try {
      await creditReferrerForEsim(db, deps.logger, after.id, deps.push);
    } catch (error) {
      deps.logger.warn({ esimId: after.id, err: error }, 'referral credit failed');
    }
  }

  const sent: NoticeKind[] = [];
  for (const kind of noticesDue(after, found.validityDays, now)) {
    if (await sendNotice(deps, after, kind)) sent.push(kind);
  }
  if (changed) await pushLiveActivities(deps, after);
  return { changed, notices: sent };
}

export async function queueTrackedEsims(db: Database, queue: JobQueue, options: { limit: number }): Promise<number> {
  const rows = await db
    .select({ id: esim.id })
    .from(esim)
    .where(inArray(esim.status, ['not_started', 'active']))
    .orderBy(sql`${esim.usageSyncedAt} asc nulls first`)
    .limit(options.limit);
  for (const row of rows) {
    await queue.send(JOB.usageOne, { esimId: row.id }, { singletonKey: row.id });
  }
  return rows.length;
}

export async function syncTrackedEsims(deps: UsageDeps, options: { limit: number }): Promise<{ synced: number; failed: number }> {
  const rows = await deps.db
    .select({ id: esim.id })
    .from(esim)
    .where(inArray(esim.status, ['not_started', 'active']))
    .orderBy(sql`${esim.usageSyncedAt} asc nulls first`)
    .limit(options.limit);
  let failed = 0;
  for (const row of rows) {
    try {
      await syncEsimUsage(deps, row.id);
    } catch (error) {
      failed += 1;
      deps.logger.warn({ esimId: row.id, err: error }, 'usage sync failed for one eSIM');
    }
  }
  return { synced: rows.length - failed, failed };
}

export async function dailyUsage(db: Database, userId: string, iccid: string, today: Date = new Date()): Promise<DailyUsage[]> {
  const [row] = await db.select({ id: esim.id }).from(esim).where(and(eq(esim.userId, userId), eq(esim.iccid, iccid)));
  if (!row) throw notFound('eSIM');
  const last = utcDay(today);
  const snapshots = await db
    .select()
    .from(usageSnapshot)
    .where(and(eq(usageSnapshot.esimId, row.id), lte(usageSnapshot.day, last)))
    .orderBy(asc(usageSnapshot.day));
  const byDay = new Map(snapshots.map((item) => [item.day, item.usedMb]));
  const first = new Date(Date.parse(`${last}T00:00:00Z`) - (DAILY_DAYS - 1) * DAY_MS);
  let running = snapshots.filter((item) => item.day < utcDay(first)).at(-1)?.usedMb ?? 0;
  return Array.from({ length: DAILY_DAYS }, (_, index) => {
    const day = utcDay(new Date(first.getTime() + index * DAY_MS));
    const total = byDay.get(day) ?? running;
    const used = Math.max(0, total - running);
    running = total;
    return { date: day, used_mb: used };
  });
}
