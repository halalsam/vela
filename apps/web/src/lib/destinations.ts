import type { Country, Plan, Region } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { serverApi } from './api';
import { localized, type Locale } from './i18n';

export type DestinationSummary = {
  slug: string;
  name: string;
  altName: string;
  codes: string[];
  from: string;
  isRegion: boolean;
};

export async function loadCatalog() {
  const [countries, regions] = await Promise.all([serverApi.getCountries(), serverApi.getRegions()]);
  return { countries, regions };
}

export function summarizeCountry(country: Country, locale: Locale): DestinationSummary {
  return {
    slug: country.code.toLowerCase(),
    name: localized(country.name, locale),
    altName: localized(country.name, locale === 'ar' ? 'en' : 'ar'),
    codes: [country.code],
    from: formatPrice(country.from_price, country.currency),
    isRegion: false,
  };
}

export function summarizeRegion(region: Region, locale: Locale): DestinationSummary {
  return {
    slug: region.id,
    name: localized(region.name, locale),
    altName: localized(region.name, locale === 'ar' ? 'en' : 'ar'),
    codes: region.country_codes,
    from: formatPrice(region.from_price, region.currency),
    isRegion: true,
  };
}

export async function loadDestination(slug: string) {
  const { countries, regions } = await loadCatalog();
  const country = countries.find((item) => item.code.toLowerCase() === slug);
  if (country) {
    const plans = await serverApi.getPlans(country.code);
    return { kind: 'country' as const, country, region: null, plans };
  }
  const region = regions.find((item) => item.id === slug);
  if (region) {
    const plans = await serverApi.getRegionPlans(region.id);
    return { kind: 'region' as const, country: null, region, plans };
  }
  return null;
}

export function allDestinationSlugs(countries: Country[], regions: Region[]): string[] {
  return [...countries.map((country) => country.code.toLowerCase()), ...regions.map((region) => region.id)];
}

export type PlanView = {
  id: string;
  data: string;
  days: string;
  price: string;
  perGb: string;
  is5g: boolean;
  hotspot: boolean;
  best: boolean;
};

export function planTitle(plan: Plan, name: string): string {
  return `${name} · ${Math.round(plan.data_mb / 1024)} GB`;
}
