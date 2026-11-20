import type { Plan } from '../schemas';
import { countries, regions } from './countries';

const networksByCountry: Record<string, string[]> = {
  JP: ['NTT Docomo', 'SoftBank'],
  TH: ['AIS', 'TrueMove H'],
  AE: ['Etisalat', 'du'],
  ID: ['Telkomsel'],
  SG: ['Singtel', 'StarHub'],
  GB: ['EE', 'Vodafone'],
  FR: ['Orange', 'SFR'],
};

const tiers = [
  { gb: 3, days: 7, multiplier: 1 },
  { gb: 10, days: 15, multiplier: 2.4 },
  { gb: 20, days: 30, multiplier: 4 },
];

function round9(value: number): number {
  return Math.round(value / 50) * 50 - 1;
}

export const plans: Plan[] = countries.flatMap((country) =>
  tiers.map((tier) => ({
    id: `${country.code.toLowerCase()}-${tier.gb}gb-${tier.days}d`,
    type: 'country' as const,
    country_codes: [country.code],
    data_mb: tier.gb * 1024,
    validity_days: tier.days,
    price: tier.multiplier === 1 ? country.from_price : round9(country.from_price * tier.multiplier),
    currency: country.currency,
    networks: networksByCountry[country.code] ?? ['Partner network'],
    is_5g: ['JP', 'AE', 'SG', 'GB', 'US', 'SA', 'QA'].includes(country.code),
    hotspot: true,
    activation: 'on_first_connection' as const,
  })),
);

const regionTiers = [
  { gb: 5, days: 15, multiplier: 1 },
  { gb: 10, days: 30, multiplier: 1.7 },
  { gb: 20, days: 30, multiplier: 2.8 },
];

export const regionPlans: Plan[] = regions.flatMap((region) =>
  regionTiers.map((tier) => ({
    id: `${region.id}-${tier.gb}gb-${tier.days}d`,
    type: region.id === 'global' ? ('global' as const) : ('regional' as const),
    country_codes: region.country_codes,
    data_mb: tier.gb * 1024,
    validity_days: tier.days,
    price: tier.multiplier === 1 ? region.from_price : round9(region.from_price * tier.multiplier),
    currency: region.currency,
    networks: ['Best local network in each country'],
    is_5g: false,
    hotspot: true,
    activation: 'on_first_connection' as const,
  })),
);
