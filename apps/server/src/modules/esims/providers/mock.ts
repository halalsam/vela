import { createHash } from 'node:crypto';
import { plans, regionPlans } from '@vela/api/mocks';
import type { EsimProvider, ProviderPlan, PurchasedEsim } from '../provider';

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

export function createMockProvider(): EsimProvider {
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
      }));
    },
    async purchase({ planRef, idempotencyKey }) {
      return mockPurchase(planRef, idempotencyKey);
    },
  };
}
