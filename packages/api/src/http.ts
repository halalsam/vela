import { z } from 'zod';
import { ApiError, type VelaApi } from './client';
import { countrySchema, offerSchema, planSchema, regionSchema, type Currency } from './schemas';

export type HttpApiOptions = {
  baseUrl: string;
  fallback: VelaApi;
  currency?: () => Currency;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

export const httpServedMethods = ['getCountries', 'getRegions', 'getPlans', 'getRegionPlans', 'getPlan', 'getOffers'] as const;

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export function createHttpApi(options: HttpApiOptions): VelaApi {
  const request = options.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const base = options.baseUrl.replace(/\/$/, '');

  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await request(`${base}${path}`, {
      headers: { accept: 'application/json', ...(await options.headers?.()) },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorBody.safeParse(body);
      throw new ApiError(parsed.success ? parsed.data.error.message : `Request failed with ${response.status}`, response.status);
    }
    return schema.parse(body);
  }

  const currency = () => `currency=${options.currency?.() ?? 'INR'}`;

  return {
    ...options.fallback,
    getCountries: () => get(`/v1/catalog/countries?${currency()}`, z.array(countrySchema)),
    getRegions: () => get(`/v1/catalog/regions?${currency()}`, z.array(regionSchema)),
    getPlans: (countryCode) =>
      get(`/v1/catalog/plans?country=${encodeURIComponent(countryCode.toUpperCase())}&${currency()}`, z.array(planSchema)),
    getRegionPlans: (regionId) => get(`/v1/catalog/regions/${encodeURIComponent(regionId)}/plans?${currency()}`, z.array(planSchema)),
    getPlan: (id) => get(`/v1/catalog/plans/${encodeURIComponent(id)}?${currency()}`, planSchema),
    getOffers: () => get('/v1/offers', z.array(offerSchema)),
  };
}
