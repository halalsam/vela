import type { Database } from '../db/client';
import { notFound } from '../lib/errors';
import * as esims from '../models/esim.model';
import * as profiles from '../models/profile.model';

export async function registerDevice(db: Database, userId: string, input: { platform: 'ios' | 'android'; pushToken: string; locale: string }) {
  await profiles.upsertDevice(db, { userId, ...input });
}

export async function removeDevice(db: Database, userId: string, pushToken: string) {
  await profiles.deleteUserDevice(db, userId, pushToken);
}

async function ownedEsimId(db: Database, userId: string, iccid: string): Promise<string> {
  const owned = await esims.findUserEsim(db, userId, iccid);
  if (!owned) throw notFound('eSIM');
  return owned.id;
}

/** Links an iOS Live Activity to the user's eSIM so usage updates reach it. */
export async function startLiveActivity(
  db: Database,
  userId: string,
  iccid: string,
  input: { pushToken: string; locale: string; deviceToken?: string },
) {
  const esimId = await ownedEsimId(db, userId, iccid);
  const deviceId = input.deviceToken ? await profiles.findUserDeviceId(db, userId, input.deviceToken) : null;
  await esims.upsertLiveActivity(db, { esimId, userId, deviceId, locale: input.locale, pushToken: input.pushToken });
}

export async function endLiveActivity(db: Database, userId: string, iccid: string) {
  await esims.endLiveActivitiesFor(db, await ownedEsimId(db, userId, iccid));
}
