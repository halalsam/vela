import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { esim, esimNotice, liveActivity, order, plan, topUpPack, usageSnapshot } from '../db/schema';

export type EsimRow = typeof esim.$inferSelect;
export type NewEsim = typeof esim.$inferInsert;
export type EsimStatusValue = EsimRow['status'];
export type LiveActivityRow = typeof liveActivity.$inferSelect;

export const TRACKED_STATUSES: EsimStatusValue[] = ['not_started', 'active'];

export async function findEsim(db: Database, id: string): Promise<EsimRow | null> {
  const [row] = await db.select().from(esim).where(eq(esim.id, id));
  return row ?? null;
}

export async function findEsimByIccid(db: Database, iccid: string): Promise<EsimRow | null> {
  const [row] = await db.select().from(esim).where(eq(esim.iccid, iccid));
  return row ?? null;
}

export async function findUserEsim(db: Database, userId: string, iccid: string): Promise<EsimRow | null> {
  const [row] = await db.select().from(esim).where(and(eq(esim.userId, userId), eq(esim.iccid, iccid)));
  return row ?? null;
}

/** An eSIM by its supplier reference or its ICCID, whichever is given. */
export async function findEsimIdByRef(db: Database, ref: { providerRef?: string; iccid?: string }): Promise<string | null> {
  const conditions = [ref.providerRef ? eq(esim.providerRef, ref.providerRef) : undefined, ref.iccid ? eq(esim.iccid, ref.iccid) : undefined].filter(
    (value): value is NonNullable<typeof value> => value !== undefined,
  );
  if (conditions.length === 0) return null;
  const [row] = await db.select({ id: esim.id }).from(esim).where(or(...conditions));
  return row?.id ?? null;
}

export async function iccidOf(db: Database, id: string): Promise<string | null> {
  const [row] = await db.select({ iccid: esim.iccid }).from(esim).where(eq(esim.id, id));
  return row?.iccid ?? null;
}

/** Inserts the eSIM unless its ICCID is already stored. */
export async function insertEsimIfNew(db: Database, values: NewEsim): Promise<void> {
  await db.insert(esim).values(values).onConflictDoNothing();
}

export async function updateEsim(db: Database, id: string, values: Partial<NewEsim>): Promise<EsimRow | null> {
  const [row] = await db
    .update(esim)
    .set({ updatedAt: new Date(), ...values })
    .where(eq(esim.id, id))
    .returning();
  return row ?? null;
}

export async function listUserEsimsWithPlan(db: Database, userId: string) {
  return db.select({ esim, plan }).from(esim).innerJoin(plan, eq(plan.id, esim.planId)).where(eq(esim.userId, userId)).orderBy(desc(esim.createdAt));
}

export async function findUserEsimWithPlan(db: Database, userId: string, iccid: string) {
  const [row] = await db
    .select({ esim, plan })
    .from(esim)
    .innerJoin(plan, eq(plan.id, esim.planId))
    .where(and(eq(esim.userId, userId), eq(esim.iccid, iccid)));
  return row ?? null;
}

export async function findEsimForUsage(db: Database, id: string) {
  const [row] = await db
    .select({ esim, validityDays: plan.validityDays, planMb: plan.dataMb })
    .from(esim)
    .innerJoin(plan, eq(plan.id, esim.planId))
    .where(eq(esim.id, id));
  return row ?? null;
}

/** Days added to the eSIM by fulfilled top-ups. */
export async function topUpExtraDays(db: Database, esimId: string): Promise<number> {
  const [row] = await db
    .select({ days: sql<number>`coalesce(sum(${topUpPack.extraDays}), 0)::int` })
    .from(order)
    .innerJoin(topUpPack, eq(topUpPack.id, order.topUpPackId))
    .where(and(eq(order.esimId, esimId), eq(order.kind, 'top_up'), eq(order.status, 'fulfilled')));
  return row?.days ?? 0;
}

/** eSIMs whose usage we still follow, least recently synced first. */
export async function trackedEsimIds(db: Database, limit: number): Promise<string[]> {
  const rows = await db
    .select({ id: esim.id })
    .from(esim)
    .where(inArray(esim.status, TRACKED_STATUSES))
    .orderBy(sql`${esim.usageSyncedAt} asc nulls first`)
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function countUserEsims(db: Database, userId: string): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(esim).where(eq(esim.userId, userId));
  return row?.value ?? 0;
}

/* Usage snapshots: one running total per eSIM per UTC day. */

export async function saveUsageSnapshot(db: Database, esimId: string, day: string, usedMb: number): Promise<void> {
  await db
    .insert(usageSnapshot)
    .values({ esimId, day, usedMb })
    .onConflictDoUpdate({ target: [usageSnapshot.esimId, usageSnapshot.day], set: { usedMb: sql`excluded.used_mb` } });
}

export async function usageSnapshotsUpTo(db: Database, esimId: string, lastDay: string) {
  return db
    .select()
    .from(usageSnapshot)
    .where(and(eq(usageSnapshot.esimId, esimId), lte(usageSnapshot.day, lastDay)))
    .orderBy(asc(usageSnapshot.day));
}

/* Notices: each kind is sent at most once per eSIM until it is reset. */

/** Claims the notice; false when it was already sent. */
export async function claimNotice(db: Database, esimId: string, kind: string): Promise<boolean> {
  const [claimed] = await db.insert(esimNotice).values({ esimId, kind }).onConflictDoNothing().returning();
  return Boolean(claimed);
}

export async function resetNotices(db: Database, esimId: string, kinds: string[]): Promise<void> {
  await db.delete(esimNotice).where(and(eq(esimNotice.esimId, esimId), inArray(esimNotice.kind, kinds)));
}

/* Live Activities on iOS that follow an eSIM. */

export async function openLiveActivities(db: Database, esimId: string): Promise<LiveActivityRow[]> {
  return db
    .select()
    .from(liveActivity)
    .where(and(eq(liveActivity.esimId, esimId), isNull(liveActivity.endedAt)));
}

export async function endLiveActivity(db: Database, id: string): Promise<void> {
  await db.update(liveActivity).set({ endedAt: new Date(), updatedAt: new Date() }).where(eq(liveActivity.id, id));
}

/** Starts following the eSIM on an iOS Live Activity (or restarts it for the same push token). */
export async function upsertLiveActivity(
  db: Database,
  values: { esimId: string; userId: string; deviceId: string | null; locale: string; pushToken: string },
): Promise<void> {
  await db
    .insert(liveActivity)
    .values(values)
    .onConflictDoUpdate({
      target: liveActivity.pushToken,
      set: { esimId: values.esimId, userId: values.userId, locale: values.locale, endedAt: null, updatedAt: sql`now()` },
    });
}

export async function endLiveActivitiesFor(db: Database, esimId: string): Promise<void> {
  await db
    .update(liveActivity)
    .set({ endedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(liveActivity.esimId, esimId), isNull(liveActivity.endedAt)));
}
