export type CurrencyCode = 'INR' | 'AED' | 'SAR' | 'QAR' | 'USD';

const MINOR_UNITS: Record<CurrencyCode, number> = { INR: 100, AED: 100, SAR: 100, QAR: 100, USD: 100 };

export function toMinor(amount: number, currency: CurrencyCode): number {
  return Math.round(amount * MINOR_UNITS[currency]);
}

export function fromMinor(minor: number, currency: CurrencyCode): number {
  return minor / MINOR_UNITS[currency];
}

export function inclusiveTax(totalMinor: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round(totalMinor - totalMinor / (1 + rate));
}

export function percentOf(minor: number, percent: number): number {
  return Math.round((minor * percent) / 100);
}
