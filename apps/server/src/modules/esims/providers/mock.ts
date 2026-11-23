import { createHash } from 'node:crypto';
import { plans, regionPlans } from '@vela/api/mocks';
import type { EsimProvider, EsimUsage, ProviderPlan, PurchasedEsim, UsageQuery } from '../provider';

const COST_SHARE = 0.62;
const SMDP = 'smdp.mock.vela.invalid';

function digitsFrom(seed: string, length: number): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return Array.from({ length }, (_, index) => (parseInt(hex.slice(index * 2, index * 2 + 2), 16) % 10).toString()).join('');
}

export function mockPurchase(planRef: string, idempotencyKey: string): PurchasedEsim {
  const iccid = `8999${digitsFrom(idempotencyKey, 15)}`;
  const activationCode = `K2-${createHash('sha256').update(`${planRef}:${idempotencyKey}`).digest('hex').slice(0, 16).toUpperCase()}`;
  return { iccid, smdp: SMDP, activationCode, lpa: ['LPA:1', SMDP, activationCode].join('$'), providerRef: `mock-${iccid}` };
}

const MOCK_TOP_UPS = [
  { gb: 1, extraDays: 0, price: 199 },
  { gb: 3, extraDays: 0, price: 449 },
  { gb: 5, extraDays: 7, price: 649 },
];

const CONNECTS_AFTER_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
const BURN_RATE = 1.05;

export function mockUsage(query: UsageQuery, now: number, speed: number): EsimUsage {
  const elapsed = (now - query.purchasedAt.getTime()) * speed;
  if (elapsed < CONNECTS_AFTER_MS) {
    return { usedMb: 0, totalMb: query.totalMb, status: 'not_started', activatedAt: null, expiresAt: null };
  }
  const activatedAt = new Date(query.purchasedAt.getTime() + CONNECTS_AFTER_MS / speed);
  const validityMs = query.validityDays * DAY_MS;
  const expiresAt = new Date(activatedAt.getTime() + (validityMs + query.extraDays * DAY_MS) / speed);
  const active = elapsed - CONNECTS_AFTER_MS;
  const usedMb = Math.min(query.totalMb, Math.round((query.planMb * BURN_RATE * active) / validityMs));
  const status = usedMb >= query.totalMb ? 'depleted' : now >= expiresAt.getTime() ? 'expired' : 'active';
  return { usedMb, totalMb: query.totalMb, status, activatedAt, expiresAt };
}

export function createMockProvider(options: { usageSpeed?: number; now?: () => number } = {}): EsimProvider {
  const speed = options.usageSpeed ?? 1;
  const now = options.now ?? Date.now;
  return {
    name: 'mock',
    async listPlans(): Promise<ProviderPlan[]> {
      return [...plans, ...regionPlans].map((plan) => ({
        ref: plan.id,
        type: plan.type,
        regionRef: plan.type === 'country' ? null : (plan.id.split('-')[0] ?? null),
        countryCodes: plan.country_codes,
        dataMb: plan.data_mb,
        validityDays: plan.validity_days,
        is5g: plan.is_5g,
        hotspot: plan.hotspot,
        networks: plan.networks,
        activation: plan.activation,
        cost: { amountMinor: Math.round(plan.price * 100 * COST_SHARE), currency: plan.currency },
        suggestedRetail: [{ amountMinor: plan.price * 100, currency: plan.currency }],
        topUps: MOCK_TOP_UPS.map((pack) => ({
          ref: `${plan.id}:topup-${pack.gb}gb`,
          dataMb: pack.gb * 1024,
          extraDays: pack.extraDays,
          cost: { amountMinor: Math.round(pack.price * 100 * COST_SHARE), currency: plan.currency },
          suggestedRetail: [{ amountMinor: pack.price * 100, currency: plan.currency }],
        })),
      }));
    },
    async purchase({ planRef, idempotencyKey }) {
      return mockPurchase(planRef, idempotencyKey);
    },
    async usage(query) {
      return mockUsage(query, now(), speed);
    },
    async cancel() {
      return true;
    },
    async topUp({ iccid, packRef, idempotencyKey }) {
      return { providerRef: `mock-topup-${iccid}-${packRef}-${idempotencyKey}` };
    },
  };
}
