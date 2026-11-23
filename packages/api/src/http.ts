import { z } from 'zod';
import { ApiError, type VelaApi } from './client';
import {
  checkoutSchema,
  countrySchema,
  couponSchema,
  esimSchema,
  offerSchema,
  orderSchema,
  planSchema,
  regionSchema,
  type Currency,
} from './schemas';

export type HttpApiOptions = {
  baseUrl: string;
  fallback: VelaApi;
  currency?: () => Currency;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  credentials?: 'include' | 'omit' | 'same-origin';
};

export const httpServedMethods = [
  'getCountries',
  'getRegions',
  'getPlans',
  'getRegionPlans',
  'getPlan',
  'getOffers',
  'redeemCoupon',
  'createOrder',
  'confirmPayment',
  'getOrder',
  'getEsims',
  'getEsim',
] as const;

function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export function createHttpApi(options: HttpApiOptions): VelaApi {
  const request = options.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const base = options.baseUrl.replace(/\/$/, '');

  async function send<T>(path: string, schema: z.ZodType<T>, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
    const response = await request(`${base}${path}`, {
      method: init.method ?? 'GET',
      credentials: options.credentials,
      headers: {
        accept: 'application/json',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
        ...(await options.headers?.()),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorBody.safeParse(body);
      throw new ApiError(parsed.success ? parsed.data.error.message : `Request failed with ${response.status}`, response.status);
    }
    return schema.parse(body);
  }

  const get = <T>(path: string, schema: z.ZodType<T>) => send(path, schema);

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
    redeemCoupon: (code) => send('/v1/coupons/validate', couponSchema, { method: 'POST', body: { code, currency: options.currency?.() ?? 'INR' } }),
    createOrder: (input) =>
      send('/v1/orders', checkoutSchema, {
        method: 'POST',
        headers: { 'idempotency-key': input.idempotencyKey ?? idempotencyKey() },
        body: { plan_id: input.planId, coupon_code: input.couponCode ?? null, currency: input.currency ?? options.currency?.() ?? 'INR' },
      }),
    confirmPayment: (orderId, result) =>
      send(`/v1/orders/${encodeURIComponent(orderId)}/confirm`, orderSchema, { method: 'POST', body: result }),
    getOrder: (orderId) => get(`/v1/orders/${encodeURIComponent(orderId)}`, orderSchema),
    getEsims: () => get('/v1/esims', z.array(esimSchema)),
    getEsim: (iccid) => get(`/v1/esims/${encodeURIComponent(iccid)}`, esimSchema),
  };
}
