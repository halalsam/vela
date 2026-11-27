import type { Country, Offer, Plan, Region } from '@vela/api';
import type { CurrencyCode } from '../lib/money';
import type { CountryRow, OfferRow, RegionRow } from '../models/catalog.model';
import type { PlanRow } from '../models/plan.model';

const toMajor = (minor: number) => minor / 100;

export function planView(row: PlanRow, priceMinor: number, currency: CurrencyCode): Plan {
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

export function countryView(row: CountryRow, fromMinor: number | null, currency: CurrencyCode): Country {
  return {
    code: row.code,
    name: { en: row.nameEn, ar: row.nameAr },
    region: row.area,
    popular: row.popular,
    from_price: toMajor(fromMinor ?? 0),
    currency,
  };
}

export function regionView(row: RegionRow, countryCodes: string[], fromMinor: number | null, currency: CurrencyCode): Region {
  return {
    id: row.id,
    name: { en: row.nameEn, ar: row.nameAr },
    country_codes: countryCodes,
    from_price: toMajor(fromMinor ?? 0),
    currency,
  };
}

export function offerView(row: OfferRow): Offer {
  return {
    id: row.id,
    title: { en: row.titleEn, ar: row.titleAr },
    body: { en: row.bodyEn, ar: row.bodyAr },
    tag: { en: row.tagEn, ar: row.tagAr },
    code: row.couponCode,
    discount_pct: row.discountPct,
    country_codes: row.countryCodes,
    ends_at: row.endsAt ? row.endsAt.toISOString() : null,
  };
}
