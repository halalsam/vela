import { MB_PER_GB } from './data';

export type PricedPlan = {
  id: string;
  data_mb: number;
  price: number;
};

export function pricePerGb(plan: Pick<PricedPlan, 'data_mb' | 'price'>): number {
  if (plan.data_mb <= 0) return Number.POSITIVE_INFINITY;
  return plan.price / (plan.data_mb / MB_PER_GB);
}

export function bestValuePlanId(plans: readonly PricedPlan[]): string | undefined {
  let best: PricedPlan | undefined;
  for (const plan of plans) {
    if (!best || pricePerGb(plan) < pricePerGb(best)) best = plan;
  }
  return plans.length > 1 ? best?.id : undefined;
}

export function cheapestPrice(plans: readonly Pick<PricedPlan, 'price'>[]): number | undefined {
  if (plans.length === 0) return undefined;
  return Math.min(...plans.map((plan) => plan.price));
}
