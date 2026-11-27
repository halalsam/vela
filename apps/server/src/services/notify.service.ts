import type { Database } from '../db/client';
import type { PushSender } from '../integrations/push';
import type { Logger } from '../logger';
import * as esims from '../models/esim.model';
import * as plans from '../models/plan.model';
import * as profiles from '../models/profile.model';
import { tripContentState } from '../views/esim.view';
import { leftLabel, noticeMessage, toLocale, type Locale, type NoticeKind } from '../views/messages.view';

export type NotifyDeps = { db: Database; logger: Logger; push: PushSender };

type EsimRow = esims.EsimRow;

const ENDED_LINGER_SECONDS = 4 * 3600;

/** The plan's place name in each language: the region for regional plans, else the first country. */
export async function placeNames(db: Database, planId: string): Promise<Record<Locale, string>> {
  const row = await plans.findPlanRow(db, planId);
  if (!row) return { en: planId, ar: planId };
  if (row.type !== 'country' && row.regionId) {
    const named = await plans.findRegionNames(db, row.regionId);
    if (named) return named;
  }
  const code = row.countryCodes[0] ?? '';
  return (await plans.findCountryNames(db, code)) ?? { en: code, ar: code };
}

/** Pushes to each device and forgets devices whose token is no longer valid. */
async function pushToDevices(
  deps: NotifyDeps,
  devices: profiles.DeviceRow[],
  build: (locale: Locale) => { title: string; body: string },
  data: Record<string, string>,
): Promise<{ sent: number; removed: number }> {
  const stale: string[] = [];
  let sent = 0;
  for (const target of devices) {
    const result = await deps.push.notify({ platform: target.platform, token: target.pushToken }, { ...build(toLocale(target.locale)), data });
    if (result === 'sent') sent += 1;
    if (result === 'invalid_token') stale.push(target.id);
  }
  await profiles.deleteDevices(deps.db, stale);
  return { sent, removed: stale.length };
}

/** Sends an eSIM notice once; false when this kind was already sent for the eSIM. */
export async function sendNotice(deps: NotifyDeps, row: EsimRow, kind: NoticeKind): Promise<boolean> {
  if (!(await esims.claimNotice(deps.db, row.id, kind))) return false;
  const devices = await profiles.listUserDevices(deps.db, row.userId);
  if (devices.length === 0) return true;
  const places = await placeNames(deps.db, row.planId);
  const left = leftLabel({ status: row.status, usedMb: row.dataUsedMb, totalMb: row.dataTotalMb });
  const result = await pushToDevices(deps, devices, (locale) => noticeMessage(kind, locale, { place: places[locale], left }), {
    kind,
    iccid: row.iccid,
  });
  deps.logger.info({ esimId: row.id, kind, devices: devices.length, removed: result.removed }, 'notice sent');
  return true;
}

export async function notifyUser(
  deps: NotifyDeps,
  userId: string,
  build: (locale: Locale) => { title: string; body: string },
  data: Record<string, string>,
): Promise<number> {
  const devices = await profiles.listUserDevices(deps.db, userId);
  return (await pushToDevices(deps, devices, build, data)).sent;
}

/** Updates (or ends) the iOS Live Activities that follow this eSIM. */
export async function pushLiveActivities(deps: NotifyDeps, row: EsimRow): Promise<number> {
  const open = await esims.openLiveActivities(deps.db, row.id);
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
    if (ended || result === 'invalid_token') await esims.endLiveActivity(deps.db, activity.id);
  }
  return sent;
}
