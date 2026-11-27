import type { DailyUsage } from '@vela/api';
import { isLowData } from '@vela/utils';
import type { Database } from '../db/client';
import { providerFor } from '../integrations/esims';
import type { EsimProvider } from '../integrations/esims/provider';
import type { PushSender } from '../integrations/push';
import { JOB, type JobQueue } from '../jobs/queue';
import { notFound } from '../lib/errors';
import type { Logger } from '../logger';
import * as esims from '../models/esim.model';
import { dailyUsageView } from '../views/esim.view';
import type { NoticeKind } from '../views/messages.view';
import { pushLiveActivities, sendNotice } from './notify.service';
import { creditReferrerForEsim } from './rewards.service';

export type UsageDeps = { db: Database; logger: Logger; provider: EsimProvider; backupProvider?: EsimProvider | null; push: PushSender; now?: () => Date };

type EsimRow = esims.EsimRow;

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
  const found = await esims.findEsimForUsage(db, esimId);
  if (!found) return { changed: false, notices: [] };
  const before = found.esim;
  const extraDays = await esims.topUpExtraDays(db, before.id);
  const usage = await providerFor(deps.provider, deps.backupProvider, before.provider).usage({
    iccid: before.iccid,
    providerRef: before.providerRef,
    purchasedAt: before.createdAt,
    planMb: found.planMb,
    totalMb: before.dataTotalMb,
    validityDays: found.validityDays,
    extraDays,
  });
  const changed =
    usage.usedMb !== before.dataUsedMb ||
    usage.totalMb !== before.dataTotalMb ||
    usage.status !== before.status ||
    (usage.expiresAt?.getTime() ?? null) !== (before.expiresAt?.getTime() ?? null);

  const after = await esims.updateEsim(db, before.id, {
    dataUsedMb: usage.usedMb,
    dataTotalMb: usage.totalMb,
    status: usage.status,
    activatedAt: usage.activatedAt ?? before.activatedAt,
    expiresAt: usage.expiresAt ?? before.expiresAt,
    usageSyncedAt: now,
    updatedAt: now,
  });
  if (!after) return { changed: false, notices: [] };

  if (usage.status !== 'not_started') {
    await esims.saveUsageSnapshot(db, after.id, utcDay(now), usage.usedMb);
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
  const ids = await esims.trackedEsimIds(db, options.limit);
  for (const id of ids) {
    await queue.send(JOB.usageOne, { esimId: id }, { singletonKey: id });
  }
  return ids.length;
}

export async function syncTrackedEsims(deps: UsageDeps, options: { limit: number }): Promise<{ synced: number; failed: number }> {
  const ids = await esims.trackedEsimIds(deps.db, options.limit);
  let failed = 0;
  for (const id of ids) {
    try {
      await syncEsimUsage(deps, id);
    } catch (error) {
      failed += 1;
      deps.logger.warn({ esimId: id, err: error }, 'usage sync failed for one eSIM');
    }
  }
  return { synced: ids.length - failed, failed };
}

export async function dailyUsage(db: Database, userId: string, iccid: string, today: Date = new Date()): Promise<DailyUsage[]> {
  const row = await esims.findUserEsim(db, userId, iccid);
  if (!row) throw notFound('eSIM');
  const last = utcDay(today);
  const snapshots = await esims.usageSnapshotsUpTo(db, row.id, last);
  const byDay = new Map(snapshots.map((item) => [item.day, item.usedMb]));
  const first = new Date(Date.parse(`${last}T00:00:00Z`) - (DAILY_DAYS - 1) * DAY_MS);
  let running = snapshots.filter((item) => item.day < utcDay(first)).at(-1)?.usedMb ?? 0;
  return Array.from({ length: DAILY_DAYS }, (_, index) => {
    const day = utcDay(new Date(first.getTime() + index * DAY_MS));
    const total = byDay.get(day) ?? running;
    const used = Math.max(0, total - running);
    running = total;
    return dailyUsageView(day, used);
  });
}
