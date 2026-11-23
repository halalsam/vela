import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { country, device, esim, esimNotice, liveActivity, plan, region } from '../../db/schema';
import type { Logger } from '../../logger';
import { leftLabel, noticeMessage, statusLabel, toLocale, type Locale, type NoticeKind } from './messages';
import type { PushSender } from './push';

export type NotifyDeps = { db: Database; logger: Logger; push: PushSender };

type EsimRow = typeof esim.$inferSelect;

const APPLE_EPOCH_SECONDS = 978_307_200;
const ENDED_LINGER_SECONDS = 4 * 3600;

export function appleDate(date: Date): number {
  return date.getTime() / 1000 - APPLE_EPOCH_SECONDS;
}

export async function placeNames(db: Database, planId: string): Promise<Record<Locale, string>> {
  const [row] = await db.select({ type: plan.type, regionId: plan.regionId, codes: plan.countryCodes }).from(plan).where(eq(plan.id, planId));
  if (!row) return { en: planId, ar: planId };
  if (row.type !== 'country' && row.regionId) {
    const [named] = await db.select({ en: region.nameEn, ar: region.nameAr }).from(region).where(eq(region.id, row.regionId));
    if (named) return named;
  }
  const code = row.codes[0] ?? '';
  const [named] = await db.select({ en: country.nameEn, ar: country.nameAr }).from(country).where(eq(country.code, code));
  return named ?? { en: code, ar: code };
}

export async function sendNotice(deps: NotifyDeps, row: EsimRow, kind: NoticeKind): Promise<boolean> {
  const [claimed] = await deps.db.insert(esimNotice).values({ esimId: row.id, kind }).onConflictDoNothing().returning();
  if (!claimed) return false;
  const devices = await deps.db.select().from(device).where(eq(device.userId, row.userId));
  if (devices.length === 0) return true;
  const places = await placeNames(deps.db, row.planId);
  const left = leftLabel({ status: row.status, usedMb: row.dataUsedMb, totalMb: row.dataTotalMb });
  const stale: string[] = [];
  for (const target of devices) {
    const locale = toLocale(target.locale);
    const message = noticeMessage(kind, locale, { place: places[locale], left });
    const result = await deps.push.notify(
      { platform: target.platform, token: target.pushToken },
      { ...message, data: { kind, iccid: row.iccid } },
    );
    if (result === 'invalid_token') stale.push(target.id);
  }
  if (stale.length > 0) await deps.db.delete(device).where(inArray(device.id, stale));
  deps.logger.info({ esimId: row.id, kind, devices: devices.length, removed: stale.length }, 'notice sent');
  return true;
}

export function tripContentState(row: Pick<EsimRow, 'status' | 'dataUsedMb' | 'dataTotalMb' | 'expiresAt'>, locale: Locale) {
  const state = { status: row.status, usedMb: row.dataUsedMb, totalMb: row.dataTotalMb };
  return {
    usedMB: row.dataUsedMb,
    totalMB: row.dataTotalMb,
    ...(row.expiresAt ? { expiresAt: appleDate(row.expiresAt) } : {}),
    status: row.status,
    leftLabel: leftLabel(state),
    statusLabel: statusLabel(state, locale),
  };
}

export async function pushLiveActivities(deps: NotifyDeps, row: EsimRow): Promise<number> {
  const open = await deps.db
    .select()
    .from(liveActivity)
    .where(and(eq(liveActivity.esimId, row.id), isNull(liveActivity.endedAt)));
  const ended = row.status === 'expired' || row.status === 'depleted';
  const now = Math.floor(Date.now() / 1000);
  let sent = 0;
  for (const activity of open) {
    const result = await deps.push.liveActivity(activity.pushToken, {
      event: ended ? 'end' : 'update',
      timestamp: now,
      contentState: tripContentState(row, toLocale(activity.locale)),
      ...(ended ? { dismissalDate: now + ENDED_LINGER_SECONDS } : {}),
    });
    if (result === 'sent') sent += 1;
    if (ended || result === 'invalid_token') {
      await deps.db.update(liveActivity).set({ endedAt: new Date(), updatedAt: new Date() }).where(eq(liveActivity.id, activity.id));
    }
  }
  return sent;
}
