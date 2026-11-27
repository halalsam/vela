import { and, arrayContains, asc, eq, gt, isNull, min, notInArray, or, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { country, fxRate, offer, plan, planPrice, region, regionCountry, topUpPack, topUpPrice } from '../db/schema';
import type { CurrencyCode } from '../lib/money';

export type CountryRow = typeof country.$inferSelect;
export type RegionRow = typeof region.$inferSelect;
export type OfferRow = typeof offer.$inferSelect;
type NewPlan = typeof plan.$inferInsert;
type NewTopUpPack = typeof topUpPack.$inferInsert;

const priced = (currency: CurrencyCode) => and(eq(planPrice.planId, plan.id), eq(planPrice.currency, currency));

/* Storefront reads: only active plans with a price in the selling currency. */

export async function countriesWithPlans(db: Database, currency: CurrencyCode) {
  return db
    .select({ country, fromMinor: min(planPrice.amountMinor) })
    .from(country)
    .innerJoin(plan, and(eq(plan.type, 'country'), eq(plan.active, true), sql`${country.code} = any(${plan.countryCodes})`))
    .innerJoin(planPrice, priced(currency))
    .groupBy(country.code)
    .orderBy(asc(country.nameEn));
}

export async function regionsWithPlans(db: Database, currency: CurrencyCode) {
  return db
    .select({ region, fromMinor: min(planPrice.amountMinor) })
    .from(region)
    .innerJoin(plan, and(eq(plan.regionId, region.id), eq(plan.active, true)))
    .innerJoin(planPrice, priced(currency))
    .groupBy(region.id)
    .orderBy(asc(region.type), asc(region.nameEn));
}

export async function regionMembers(db: Database) {
  return db.select().from(regionCountry);
}

export async function pricedPlansForCountry(db: Database, code: string, currency: CurrencyCode) {
  return db
    .select({ plan, priceMinor: planPrice.amountMinor })
    .from(plan)
    .innerJoin(planPrice, priced(currency))
    .where(and(eq(plan.active, true), eq(plan.type, 'country'), arrayContains(plan.countryCodes, [code])))
    .orderBy(asc(planPrice.amountMinor));
}

export async function pricedPlansForRegion(db: Database, regionId: string, currency: CurrencyCode) {
  return db
    .select({ plan, priceMinor: planPrice.amountMinor })
    .from(plan)
    .innerJoin(planPrice, priced(currency))
    .where(and(eq(plan.active, true), eq(plan.regionId, regionId)))
    .orderBy(asc(planPrice.amountMinor));
}

export async function pricedPlan(db: Database, id: string, currency: CurrencyCode) {
  const [row] = await db
    .select({ plan, priceMinor: planPrice.amountMinor })
    .from(plan)
    .innerJoin(planPrice, priced(currency))
    .where(and(eq(plan.id, id), eq(plan.active, true)));
  return row ?? null;
}

export async function liveOffers(db: Database, now: Date): Promise<OfferRow[]> {
  return db
    .select()
    .from(offer)
    .where(and(eq(offer.active, true), or(isNull(offer.endsAt), gt(offer.endsAt, now))))
    .orderBy(asc(offer.sortOrder));
}

/* Catalogue sync writes. */

export async function planRefs(db: Database) {
  return db.select({ id: plan.id, ref: plan.providerPlanRef }).from(plan);
}

export async function countryCodes(db: Database): Promise<string[]> {
  return (await db.select({ code: country.code }).from(country)).map((row) => row.code);
}

export async function regionIds(db: Database): Promise<string[]> {
  return (await db.select({ id: region.id }).from(region)).map((row) => row.id);
}

export async function insertCountryIfNew(db: Database, values: typeof country.$inferInsert): Promise<void> {
  await db.insert(country).values(values).onConflictDoNothing();
}

export async function insertRegionIfNew(db: Database, values: typeof region.$inferInsert, countries: string[]): Promise<void> {
  await db.insert(region).values(values).onConflictDoNothing();
  for (const code of countries) {
    await db.insert(regionCountry).values({ regionId: values.id, countryCode: code }).onConflictDoNothing();
  }
}

export async function upsertPlan(db: Database, id: string, values: Omit<NewPlan, 'id'>): Promise<void> {
  await db
    .insert(plan)
    .values({ id, ...values })
    .onConflictDoUpdate({ target: plan.id, set: values });
}

/** Sets a computed price, leaving prices staff set by hand alone. */
export async function upsertPlanPrice(db: Database, planId: string, currency: CurrencyCode, amountMinor: number): Promise<void> {
  await db
    .insert(planPrice)
    .values({ planId, currency, amountMinor })
    .onConflictDoUpdate({ target: [planPrice.planId, planPrice.currency], set: { amountMinor }, setWhere: eq(planPrice.manual, false) });
}

/** Upserts a top-up by (plan, supplier ref); `set` is what a later sync may change. */
export async function upsertTopUpPack(
  db: Database,
  key: Pick<NewTopUpPack, 'id' | 'planId' | 'providerPackRef'>,
  set: Omit<NewTopUpPack, 'id' | 'planId' | 'providerPackRef'>,
): Promise<string | null> {
  const [stored] = await db
    .insert(topUpPack)
    .values({ ...key, ...set })
    .onConflictDoUpdate({ target: [topUpPack.planId, topUpPack.providerPackRef], set })
    .returning({ id: topUpPack.id });
  return stored?.id ?? null;
}

export async function upsertTopUpPrice(db: Database, packId: string, currency: CurrencyCode, amountMinor: number): Promise<void> {
  await db
    .insert(topUpPrice)
    .values({ packId, currency, amountMinor })
    .onConflictDoUpdate({ target: [topUpPrice.packId, topUpPrice.currency], set: { amountMinor } });
}

/** Deactivates active top-ups not in `keep`. */
export async function deactivateTopUpsExcept(db: Database, keep: string[]): Promise<void> {
  await db
    .update(topUpPack)
    .set({ active: false })
    .where(keep.length > 0 ? and(eq(topUpPack.active, true), notInArray(topUpPack.id, keep)) : eq(topUpPack.active, true));
}

/** Deactivates active plans whose supplier ref is not in `keepRefs`; returns how many. */
export async function deactivatePlansExcept(db: Database, keepRefs: string[]): Promise<number> {
  const stale = await db
    .update(plan)
    .set({ active: false })
    .where(keepRefs.length > 0 ? and(eq(plan.active, true), notInArray(plan.providerPlanRef, keepRefs)) : eq(plan.active, true))
    .returning({ id: plan.id });
  return stale.length;
}

export async function countActivePlans(db: Database): Promise<number> {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(plan).where(eq(plan.active, true));
  return row?.total ?? 0;
}

/* Exchange rates, stored per USD. */

export async function saveRate(db: Database, currency: CurrencyCode, perUsd: number, source: string): Promise<void> {
  await db
    .insert(fxRate)
    .values({ currency, perUsd, source })
    .onConflictDoUpdate({ target: fxRate.currency, set: { perUsd, source, updatedAt: sql`now()` } });
}

export async function allRates(db: Database) {
  return db.select().from(fxRate);
}

export async function countPlans(db: Database): Promise<number> {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(plan);
  return row?.total ?? 0;
}
