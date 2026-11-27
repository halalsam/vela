import { and, count, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { coupon, couponRedemption } from '../db/schema';

export type CouponRow = typeof coupon.$inferSelect;
export type NewCoupon = typeof coupon.$inferInsert;

export async function findCoupon(db: Database, code: string): Promise<CouponRow | null> {
  const [row] = await db.select().from(coupon).where(eq(coupon.code, code));
  return row ?? null;
}

/** How many times the coupon was used, overall or by one user. */
export async function countRedemptions(db: Database, code: string, userId?: string): Promise<number> {
  const where = userId ? and(eq(couponRedemption.couponCode, code), eq(couponRedemption.userId, userId)) : eq(couponRedemption.couponCode, code);
  const [row] = await db.select({ value: count() }).from(couponRedemption).where(where);
  return row?.value ?? 0;
}

export async function recordRedemption(db: Database, values: { couponCode: string; userId: string; orderId: string }): Promise<void> {
  await db.insert(couponRedemption).values(values).onConflictDoNothing();
}

export async function allCoupons(db: Database): Promise<CouponRow[]> {
  return db.select().from(coupon).orderBy(desc(coupon.createdAt));
}

/** Redemptions per coupon code. */
export async function redemptionCounts(db: Database): Promise<Map<string, number>> {
  const rows = await db.select({ code: couponRedemption.couponCode, value: count() }).from(couponRedemption).groupBy(couponRedemption.couponCode);
  return new Map(rows.map((row) => [row.code, row.value]));
}

/** Inserts the coupon, or returns null when the code exists. */
export async function insertCoupon(db: Database, values: NewCoupon): Promise<CouponRow | null> {
  const [row] = await db.insert(coupon).values(values).onConflictDoNothing().returning();
  return row ?? null;
}

export async function updateCoupon(db: Database, code: string, values: Partial<NewCoupon>): Promise<CouponRow | null> {
  const [row] = await db
    .update(coupon)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(coupon.code, code))
    .returning();
  return row ?? null;
}
