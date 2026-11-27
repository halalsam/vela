import type { Database } from '../db/client';
import type { CurrencyCode } from '../lib/money';
import type { Logger } from '../logger';
import * as catalog from '../models/catalog.model';

export const ECB_DAILY = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const USD_PEGS: Partial<Record<CurrencyCode, number>> = { AED: 3.6725, SAR: 3.75, QAR: 3.64 };
export const SAMPLE_RATES: Record<CurrencyCode, number> = { USD: 1, INR: 84, EUR: 0.92, AED: 3.6725, SAR: 3.75, QAR: 3.64 };

export type Rates = ReadonlyMap<CurrencyCode, number>;

export function parseEcb(xml: string): Map<string, number> {
  const perEur = new Map<string, number>([['EUR', 1]]);
  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    const [, code, rate] = match;
    if (code && rate && Number(rate) > 0) perEur.set(code, Number(rate));
  }
  return perEur;
}

export function ratesPerUsd(perEur: ReadonlyMap<string, number>): Map<CurrencyCode, number> {
  const usdPerEur = perEur.get('USD');
  if (!usdPerEur) throw new Error('ECB rates have no USD');
  const rates = new Map<CurrencyCode, number>([
    ['USD', 1],
    ['EUR', 1 / usdPerEur],
  ]);
  const inrPerEur = perEur.get('INR');
  if (inrPerEur) rates.set('INR', inrPerEur / usdPerEur);
  for (const [code, peg] of Object.entries(USD_PEGS)) rates.set(code as CurrencyCode, peg);
  return rates;
}

export async function refreshRates(db: Database, logger: Logger, request: typeof fetch = fetch): Promise<number> {
  const response = await request(ECB_DAILY, { headers: { accept: 'application/xml' } });
  if (!response.ok) throw new Error(`ECB rates failed with ${response.status}`);
  const rates = ratesPerUsd(parseEcb(await response.text()));
  if (!rates.has('INR')) throw new Error('ECB rates have no INR');
  for (const [currency, perUsd] of rates) {
    await catalog.saveRate(db, currency, perUsd, USD_PEGS[currency] ? 'peg' : 'ecb');
  }
  logger.info({ rates: Object.fromEntries(rates) }, 'exchange rates updated');
  return rates.size;
}

export async function loadRates(db: Database): Promise<Rates> {
  const rows = await catalog.allRates(db);
  return new Map(rows.map((row) => [row.currency, row.perUsd]));
}

export function convertMinor(amountMinor: number, from: CurrencyCode, to: CurrencyCode, rates: Rates): number | null {
  if (from === to) return amountMinor;
  const fromRate = rates.get(from);
  const toRate = rates.get(to);
  if (!fromRate || !toRate) return null;
  return Math.round((amountMinor / fromRate) * toRate);
}
