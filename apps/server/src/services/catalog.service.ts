import type { Country, Offer, Plan, Region } from '@vela/api';
import type { Database } from '../db/client';
import type { CurrencyCode } from '../lib/money';
import * as catalog from '../models/catalog.model';
import { countryView, offerView, planView, regionView } from '../views/catalog.view';

export async function listCountries(db: Database, currency: CurrencyCode): Promise<Country[]> {
  const rows = await catalog.countriesWithPlans(db, currency);
  return rows.map((row) => countryView(row.country, row.fromMinor, currency));
}

export async function listRegions(db: Database, currency: CurrencyCode): Promise<Region[]> {
  const rows = await catalog.regionsWithPlans(db, currency);
  const members = await catalog.regionMembers(db);
  return rows.map((row) =>
    regionView(
      row.region,
      members.filter((member) => member.regionId === row.region.id).map((member) => member.countryCode),
      row.fromMinor,
      currency,
    ),
  );
}

export async function plansForCountry(db: Database, code: string, currency: CurrencyCode): Promise<Plan[]> {
  const rows = await catalog.pricedPlansForCountry(db, code.toUpperCase(), currency);
  return rows.map((row) => planView(row.plan, row.priceMinor, currency));
}

export async function plansForRegion(db: Database, regionId: string, currency: CurrencyCode): Promise<Plan[]> {
  const rows = await catalog.pricedPlansForRegion(db, regionId, currency);
  return rows.map((row) => planView(row.plan, row.priceMinor, currency));
}

/** An active plan priced in `currency`, or null. */
export async function planById(db: Database, id: string, currency: CurrencyCode): Promise<Plan | null> {
  const row = await catalog.pricedPlan(db, id, currency);
  return row ? planView(row.plan, row.priceMinor, currency) : null;
}

export async function listOffers(db: Database): Promise<Offer[]> {
  return (await catalog.liveOffers(db, new Date())).map(offerView);
}
