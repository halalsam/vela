'use client';

import type { Plan } from '@vela/api';
import { formatPrice, pricePerGb } from '@vela/utils';
import { useEffect, useState } from 'react';
import { browserApi } from './browserApi';
import { readCurrency } from './currency';

type FromPrices = { countries: Map<string, string>; regions: Map<string, string> };
export type PlanSource = { kind: 'country'; code: string } | { kind: 'region'; id: string };
export type LocalPlanPrice = { price: string; perGbAmount: string };

const live = Boolean(process.env.NEXT_PUBLIC_API_URL);
let fromPrices: Promise<FromPrices> | null = null;
const planPrices = new Map<string, Promise<Plan[]>>();

function wantsLocal(): boolean {
  return live && readCurrency() !== 'INR';
}

function loadFromPrices(): Promise<FromPrices> {
  fromPrices ??= Promise.all([browserApi.getCountries(), browserApi.getRegions()]).then(
    ([countries, regions]) => ({
      countries: new Map(countries.map((item) => [item.code.toLowerCase(), formatPrice(item.from_price, item.currency)])),
      regions: new Map(regions.map((item) => [item.id, formatPrice(item.from_price, item.currency)])),
    }),
    (error: unknown) => {
      fromPrices = null;
      throw error;
    },
  );
  return fromPrices;
}

export function useLocalFrom(slug: string, isRegion: boolean): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    if (!wantsLocal()) return;
    let cancelled = false;
    loadFromPrices().then(
      (prices) => !cancelled && setValue((isRegion ? prices.regions : prices.countries).get(slug) ?? null),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [slug, isRegion]);
  return value;
}

export function useLocalPlans(source: PlanSource): Map<string, LocalPlanPrice> | null {
  const [value, setValue] = useState<Map<string, LocalPlanPrice> | null>(null);
  const key = source.kind === 'country' ? `c:${source.code}` : `r:${source.id}`;
  useEffect(() => {
    if (!wantsLocal()) return;
    let cancelled = false;
    let request = planPrices.get(key);
    if (!request) {
      request = source.kind === 'country' ? browserApi.getPlans(source.code) : browserApi.getRegionPlans(source.id);
      planPrices.set(key, request);
      request.catch(() => planPrices.delete(key));
    }
    request.then(
      (plans) =>
        !cancelled &&
        setValue(
          new Map(
            plans.map((plan) => [
              plan.id,
              { price: formatPrice(plan.price, plan.currency), perGbAmount: formatPrice(Math.round(pricePerGb(plan) * 100) / 100, plan.currency) },
            ]),
          ),
        ),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [key, source]);
  return value;
}
