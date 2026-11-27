import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { device, profile } from '../db/schema';

export type ProfileRow = typeof profile.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
export type DeviceRow = typeof device.$inferSelect;

export async function findProfile(db: Database, userId: string): Promise<ProfileRow | null> {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  return row ?? null;
}

export async function findByReferralCode(db: Database, code: string): Promise<ProfileRow | null> {
  const [row] = await db.select().from(profile).where(eq(profile.referralCode, code));
  return row ?? null;
}

export async function listReferredBy(db: Database, userId: string): Promise<ProfileRow[]> {
  return db.select().from(profile).where(eq(profile.referredBy, userId));
}

/** Records who referred the user, unless someone already did. */
export async function setReferrerIfEmpty(db: Database, userId: string, referrerId: string): Promise<void> {
  await db
    .update(profile)
    .set({ referredBy: referrerId, updatedAt: new Date() })
    .where(and(eq(profile.userId, userId), isNull(profile.referredBy)));
}

export async function roleOf(db: Database, userId: string): Promise<ProfileRow['role'] | null> {
  const [row] = await db.select({ role: profile.role }).from(profile).where(eq(profile.userId, userId));
  return row?.role ?? null;
}

/* Devices registered for push. */

export async function listUserDevices(db: Database, userId: string): Promise<DeviceRow[]> {
  return db.select().from(device).where(eq(device.userId, userId));
}

export async function deleteDevices(db: Database, ids: string[]): Promise<void> {
  if (ids.length > 0) await db.delete(device).where(inArray(device.id, ids));
}

/** Registers the push token for the user, moving it over if another account had it. */
export async function upsertDevice(db: Database, values: { userId: string; platform: DeviceRow['platform']; pushToken: string; locale: string }): Promise<void> {
  await db
    .insert(device)
    .values(values)
    .onConflictDoUpdate({
      target: device.pushToken,
      set: { userId: values.userId, platform: values.platform, locale: values.locale, lastSeenAt: sql`now()`, updatedAt: sql`now()` },
    });
}

export async function deleteUserDevice(db: Database, userId: string, pushToken: string): Promise<void> {
  await db.delete(device).where(and(eq(device.userId, userId), eq(device.pushToken, pushToken)));
}

export async function findUserDeviceId(db: Database, userId: string, pushToken: string): Promise<string | null> {
  const [row] = await db
    .select({ id: device.id })
    .from(device)
    .where(and(eq(device.userId, userId), eq(device.pushToken, pushToken)));
  return row?.id ?? null;
}

export async function setRole(db: Database, userId: string, role: ProfileRow['role']): Promise<void> {
  await db.update(profile).set({ role, updatedAt: new Date() }).where(eq(profile.userId, userId));
}
