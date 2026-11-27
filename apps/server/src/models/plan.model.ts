import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { country, plan, region, topUpPack, topUpPrice } from '../db/schema';
import type { CurrencyCode } from '../lib/money';

export type PlanRow = typeof plan.$inferSelect;
export type TopUpPackRow = typeof topUpPack.$inferSelect;

export async function findPlanRow(db: Database, id: string): Promise<PlanRow | null> {
  const [row] = await db.select().from(plan).where(eq(plan.id, id));
  return row ?? null;
}

export async function findRegionNames(db: Database, id: string): Promise<{ en: string; ar: string } | null> {
  const [row] = await db.select({ en: region.nameEn, ar: region.nameAr }).from(region).where(eq(region.id, id));
  return row ?? null;
}

export async function findCountryNames(db: Database, code: string): Promise<{ en: string; ar: string } | null> {
  const [row] = await db.select({ en: country.nameEn, ar: country.nameAr }).from(country).where(eq(country.code, code));
  return row ?? null;
}

export async function findTopUpPack(db: Database, id: string): Promise<TopUpPackRow | null> {
  const [row] = await db.select().from(topUpPack).where(eq(topUpPack.id, id));
  return row ?? null;
}

/** Active top-ups for the plan that have a price in `currency`, smallest first. */
export async function activeTopUpsWithPrice(db: Database, planId: string, currency: CurrencyCode) {
  return db
    .select({ pack: topUpPack, priceMinor: topUpPrice.amountMinor })
    .from(topUpPack)
    .innerJoin(topUpPrice, and(eq(topUpPrice.packId, topUpPack.id), eq(topUpPrice.currency, currency)))
    .where(and(eq(topUpPack.planId, planId), eq(topUpPack.active, true)))
    .orderBy(topUpPack.dataMb);
}
