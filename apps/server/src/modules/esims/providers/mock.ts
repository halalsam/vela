import { plans, regionPlans } from '@vela/api/mocks';
import type { EsimProvider, ProviderPlan } from '../provider';

const COST_SHARE = 0.62;

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
  };
}
