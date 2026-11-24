import { z } from 'zod';
import * as mocks from './mocks';
import {
  checkoutSchema,
  couponSchema,
  orderSchema,
  orderSummarySchema,
  profileSchema,
  rewardsSchema,
  supportMessageSchema,
  countrySchema,
  dailyUsageSchema,
  esimSchema,
  offerSchema,
  planSchema,
  regionSchema,
  topUpPackSchema,
  type Checkout,
  type Coupon,
  type InvoiceLink,
  type Order,
  type OrderSummary,
  type PaymentResult,
  type Profile,
  type Rewards,
  type SupportMessage,
  type Country,
  type Currency,
  type DailyUsage,
  type Esim,
  type Offer,
  type Plan,
  type Region,
  type TopUpPack,
} from './schemas';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type CreateOrderInput = {
  planId: string;
  couponCode?: string | null;
  currency?: Currency;
  idempotencyKey?: string;
};

export type VelaApi = {
  getCountries(): Promise<Country[]>;
  getRegions(): Promise<Region[]>;
  getPlans(countryCode: string): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan>;
  getRegionPlans(regionId: string): Promise<Plan[]>;
  getEsims(): Promise<Esim[]>;
  getEsim(iccid: string): Promise<Esim>;
  getOffers(): Promise<Offer[]>;
  getTopUpPacks(iccid: string): Promise<TopUpPack[]>;
  getDailyUsage(iccid: string): Promise<DailyUsage[]>;
  getProfile(): Promise<Profile>;
  getRewards(): Promise<Rewards>;
  getSupportThread(): Promise<SupportMessage[]>;
  sendSupportMessage(text: string): Promise<SupportMessage[]>;
  redeemCoupon(code: string): Promise<Coupon>;
  createOrder(input: CreateOrderInput): Promise<Checkout>;
  confirmPayment(orderId: string, result: PaymentResult): Promise<Order>;
  getOrder(orderId: string): Promise<Order>;
  getOrders(): Promise<OrderSummary[]>;
  getInvoice(orderId: string): Promise<InvoiceLink>;
  topUp(input: { iccid: string; packId: string; currency?: Currency; idempotencyKey?: string }): Promise<Checkout>;
};

export type MockScenario = 'default' | 'loading' | 'empty' | 'error' | 'lowData' | 'expired';

export type MockApiOptions = {
  latencyMs?: number;
  scenario?: () => MockScenario;
};

export const TAX_RATE = 0.18;

export function taxRateFor(currency: Currency): number {
  return currency === 'INR' ? TAX_RATE : 0;
}

function lowData(esim: Esim): Esim {
  if (esim.status !== 'active') return esim;
  return { ...esim, data_used_mb: Math.round(esim.data_total_mb * 0.94) };
}

function expired(esim: Esim): Esim {
  const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
  return { ...esim, status: 'expired', data_used_mb: esim.data_total_mb, expires_at: past, activated_at: esim.activated_at ?? past };
}

function randomDigits(length: number): string {
  let out = '89';
  while (out.length < length) out += Math.floor(Math.random() * 10).toString();
  return out;
}

export function discountFor(coupon: Coupon | null, subtotal: number): number {
  if (!coupon) return 0;
  if (coupon.discount_pct !== null) return Math.round((subtotal * coupon.discount_pct) / 100);
  return Math.min(subtotal, coupon.discount_amount ?? 0);
}

export function priceBreakdown(price: number, coupon: Coupon | null, creditAvailable = 0, taxRate = TAX_RATE) {
  const discount = discountFor(coupon, price);
  const credit = Math.min(Math.max(0, creditAvailable), price - discount);
  const total = price - discount - credit;
  const tax = taxRate > 0 ? Math.round(total - total / (1 + taxRate)) : 0;
  return { subtotal: price, discount, credit, tax, total };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notFound(what: string): never {
  throw new ApiError(`${what} not found`, 404);
}

export function createMockApi({ latencyMs = 450, scenario = () => 'default' }: MockApiOptions = {}): VelaApi {
  const esimStore: Esim[] = [...mocks.esims];
  const thread: SupportMessage[] = [...mocks.supportThread];
  const orders = new Map<string, Order>();

  async function respond<T>(schema: z.ZodType<T>, data: () => unknown, options: { list?: boolean } = {}): Promise<T> {
    const mode = scenario();
    if (mode === 'loading') return new Promise<T>(() => undefined);
    await wait(latencyMs);
    if (mode === 'error') throw new ApiError('Something went wrong on our side', 500);
    if (mode === 'empty' && options.list) return schema.parse([]);
    return schema.parse(data());
  }

  function currentEsims(): Esim[] {
    const mode = scenario();
    if (mode === 'lowData') return esimStore.map(lowData);
    if (mode === 'expired') return esimStore.map(expired);
    return esimStore;
  }

  function findPlan(id: string): Plan {
    return [...mocks.plans, ...mocks.regionPlans].find((plan) => plan.id === id) ?? notFound('Plan');
  }

  function findCoupon(code: string): Coupon {
    return mocks.coupons.find((coupon) => coupon.code === code.trim().toUpperCase()) ?? notFound('Coupon');
  }

  return {
    getCountries: () => respond(z.array(countrySchema), () => mocks.countries, { list: true }),
    getRegions: () => respond(z.array(regionSchema), () => mocks.regions, { list: true }),
    getPlans: (countryCode) =>
      respond(
        z.array(planSchema),
        () => mocks.plans.filter((plan) => plan.country_codes.includes(countryCode.toUpperCase())),
        { list: true },
      ),
    getPlan: async (id) => respond(planSchema, () => findPlan(id)),
    getRegionPlans: (regionId) =>
      respond(z.array(planSchema), () => mocks.regionPlans.filter((plan) => plan.id.startsWith(`${regionId}-`)), { list: true }),
    getEsims: () => respond(z.array(esimSchema), currentEsims, { list: true }),
    getEsim: async (iccid) =>
      respond(esimSchema, () => currentEsims().find((esim) => esim.iccid === iccid) ?? notFound('eSIM')),
    getOffers: () => respond(z.array(offerSchema), () => mocks.offers, { list: true }),
    getTopUpPacks: (iccid) =>
      respond(z.array(topUpPackSchema), () => mocks.topUpPacks.filter((pack) => pack.iccid === iccid), { list: true }),
    getDailyUsage: (iccid) => respond(z.array(dailyUsageSchema), () => mocks.dailyUsage[iccid] ?? [], { list: true }),
    getProfile: () => respond(profileSchema, () => mocks.profile),
    getRewards: () =>
      respond(rewardsSchema, () => (scenario() === 'empty' ? { ...mocks.rewards, balance: 0, trips: 0, referrals: [] } : mocks.rewards)),
    getSupportThread: () => respond(z.array(supportMessageSchema), () => thread, { list: true }),
    sendSupportMessage: async (text) => {
      thread.push({ id: `u${thread.length + 1}`, from: 'user', text, sent_at: new Date().toISOString(), install_step: null });
      return respond(z.array(supportMessageSchema), () => thread);
    },
    redeemCoupon: async (code) => respond(couponSchema, () => findCoupon(code)),
    createOrder: async ({ planId, couponCode }) =>
      respond(checkoutSchema, () => {
        const plan = findPlan(planId);
        const coupon = couponCode ? findCoupon(couponCode) : null;
        const balance = scenario() === 'empty' ? 0 : mocks.rewards.balance;
        const breakdown = priceBreakdown(plan.price, coupon, balance);
        const iccid = randomDigits(19);
        const code = plan.country_codes[0] ?? 'XX';
        esimStore.unshift({
          iccid,
          plan_id: plan.id,
          label: `${code} · ${Math.round(plan.data_mb / 1024)} GB`,
          country_codes: plan.country_codes,
          network: plan.networks[0] ?? 'Partner network',
          is_5g: plan.is_5g,
          status: 'not_started',
          data_used_mb: 0,
          data_total_mb: plan.data_mb,
          activated_at: null,
          expires_at: null,
          lpa_string: `LPA:1$smdp.example.com$K2-${iccid.slice(-8)}`,
          qr_url: `https://example.com/qr/${iccid}.png`,
        });
        const number = `VL-${iccid.slice(-6)}`;
        const order: Order = {
          order_id: number,
          number,
          kind: 'esim',
          status: 'fulfilled',
          plan_id: plan.id,
          iccid,
          currency: plan.currency,
          ...breakdown,
        };
        orders.set(number, order);
        return { order, payment: null };
      }),
    confirmPayment: async (orderId) => respond(orderSchema, () => orders.get(orderId) ?? notFound('Order')),
    getOrder: async (orderId) => respond(orderSchema, () => orders.get(orderId) ?? notFound('Order')),
    getOrders: async () =>
      respond(
        z.array(orderSummarySchema),
        () => {
          const placed = [...orders.values()].reverse().map((item) => ({ ...item, created_at: new Date().toISOString(), invoice_number: null }));
          const past = mocks.esims.slice(0, 2).map((esim, index) => {
            const total = index === 0 ? 1199 : 899;
            return {
              order_id: `VL-PAST${index + 1}`,
              number: `VL-K7Q2${String(index + 41).padStart(4, '0')}`,
              kind: 'esim' as const,
              status: 'fulfilled' as const,
              plan_id: esim.plan_id,
              iccid: esim.iccid,
              subtotal: total,
              discount: 0,
              credit: 0,
              tax: Math.round(total - total / (1 + TAX_RATE)),
              total,
              currency: 'INR' as const,
              created_at: new Date(Date.now() - (index + 1) * 9 * 86_400_000).toISOString(),
              invoice_number: `VL/2026-27/${String(120 + index).padStart(6, '0')}`,
            };
          });
          return [...placed, ...past];
        },
        { list: true },
      ),
    getInvoice: async () => notFound('Invoice'),
    topUp: async ({ iccid, packId }) =>
      respond(checkoutSchema, () => {
        const pack = mocks.topUpPacks.find((item) => item.id === packId) ?? notFound('Top-up');
        const index = esimStore.findIndex((esim) => esim.iccid === iccid);
        const esim = esimStore[index] ?? notFound('eSIM');
        const extended = esim.expires_at && pack.extra_days > 0
          ? new Date(Date.parse(esim.expires_at) + pack.extra_days * 86_400_000).toISOString()
          : esim.expires_at;
        const updated: Esim = { ...esim, data_total_mb: esim.data_total_mb + pack.data_mb, expires_at: extended };
        esimStore[index] = updated;
        const number = `VL-T${iccid.slice(-5)}`;
        const order: Order = {
          order_id: `${number}-${Date.now().toString(36)}`,
          number,
          kind: 'top_up',
          status: 'fulfilled',
          plan_id: esim.plan_id,
          iccid,
          currency: pack.currency,
          subtotal: pack.price,
          discount: 0,
          credit: 0,
          tax: Math.round(pack.price - pack.price / (1 + TAX_RATE)),
          total: pack.price,
        };
        orders.set(order.order_id, order);
        return { order, payment: null };
      }),
  };
}
