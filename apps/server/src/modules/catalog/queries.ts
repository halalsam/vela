import type { Country, Offer, Plan, Region } from '@vela/api';
import { and, arrayContains, asc, eq, gt, isNull, min, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { country, offer, plan, planPrice, region, regionCountry } from '../../db/schema';
import type { CurrencyCode } from '../../lib/money';

type PlanRow = typeof plan.$inferSelect;

const toMajor = (minor: number) => minor / 100;

function toPlan(row: PlanRow, priceMinor: number, currency: CurrencyCode): Plan {
  return {
    id: row.id,
    type: row.type,
    country_codes: row.countryCodes,
    data_mb: row.dataMb,
    validity_days: row.validityDays,
    price: toMajor(priceMinor),
    currency,
    networks: row.networks,
    is_5g: row.is5g,
    hotspot: row.hotspot,
    activation: row.activation,
  };
}

function priced(currency: CurrencyCode) {
  return and(eq(planPrice.planId, plan.id), eq(planPrice.currency, currency));
}

export async function listCountries(db: Database, currency: CurrencyCode): Promise<Country[]> {
  const rows = await db
    .select({ country, fromMinor: min(planPrice.amountMinor) })
    .from(country)
    .innerJoin(plan, and(eq(plan.type, 'country'), eq(plan.active, true), sql`${country.code} = any(${plan.countryCodes})`))
    .innerJoin(planPrice, priced(currency))
    .groupBy(country.code)
    .orderBy(asc(country.nameEn));
  return rows.map(({ country: item, fromMinor }) => ({
    code: item.code,
    name: { en: item.nameEn, ar: item.nameAr },
    region: item.area,
    popular: item.popular,
    from_price: toMajor(fromMinor ?? 0),
    currency,
  }));
}

export async function listRegions(db: Database, currency: CurrencyCode): Promise<Region[]> {
  const rows = await db
    .select({ region, fromMinor: min(planPrice.amountMinor) })
    .from(region)
    .innerJoin(plan, and(eq(plan.regionId, region.id), eq(plan.active, true)))
    .innerJoin(planPrice, priced(currency))
    .groupBy(region.id)
    .orderBy(asc(region.type), asc(region.nameEn));
  const members = await db.select().from(regionCountry);
  return rows.map(({ region: item, fromMinor }) => ({
    id: item.id,
    name: { en: item.nameEn, ar: item.nameAr },
    country_codes: members.filter((member) => member.regionId === item.id).map((member) => member.countryCode),
    from_price: toMajor(fromMinor ?? 0),
    currency,
  }));
}

export async function plansForCountry(db: Database, code: string, currency: CurrencyCode): Promise<Plan[]> {
  const rows = await db
    .select({ plan, priceMinor: planPrice.amountMinor })
    .from(plan)
    .innerJoin(planPrice, priced(currency))
    .where(and(eq(plan.active, true), eq(plan.type, 'country'), arrayContains(plan.countryCodes, [code.toUpperCase()])))
    .orderBy(asc(planPrice.amountMinor));
  return rows.map((row) => toPlan(row.plan, row.priceMinor, currency));
}

export async function plansForRegion(db: Database, regionId: string, currency: CurrencyCode): Promise<Plan[]> {
  const rows = await db
    .select({ plan, priceMinor: planPrice.amountMinor })
    .from(plan)
    .innerJoin(planPrice, priced(currency))
    .where(and(eq(plan.active, true), eq(plan.regionId, regionId)))
    .orderBy(asc(planPrice.amountMinor));
  return rows.map((row) => toPlan(row.plan, row.priceMinor, currency));
}

export async function planById(db: Database, id: string, currency: CurrencyCode): Promise<Plan | null> {
  const [row] = await db
    .select({ plan, priceMinor: planPrice.amountMinor })
    .from(plan)
    .innerJoin(planPrice, priced(currency))
    .where(and(eq(plan.id, id), eq(plan.active, true)));
  return row ? toPlan(row.plan, row.priceMinor, currency) : null;
}

export async function listOffers(db: Database): Promise<Offer[]> {
  const rows = await db
    .select()
    .from(offer)
    .where(and(eq(offer.active, true), or(isNull(offer.endsAt), gt(offer.endsAt, new Date()))))
    .orderBy(asc(offer.sortOrder));
  return rows.map((item) => ({
    id: item.id,
    title: { en: item.titleEn, ar: item.titleAr },
    body: { en: item.bodyEn, ar: item.bodyAr },
    tag: { en: item.tagEn, ar: item.tagAr },
    code: item.couponCode,
    discount_pct: item.discountPct,
    country_codes: item.countryCodes,
    ends_at: item.endsAt ? item.endsAt.toISOString() : null,
  }));
}
