import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createMockApi } from './client';
import * as mocks from './mocks';
import { countrySchema, esimSchema, offerSchema, planSchema, regionSchema } from './schemas';

describe('mocks match the provider schemas', () => {
  it.each([
    ['countries', z.array(countrySchema), mocks.countries],
    ['regions', z.array(regionSchema), mocks.regions],
    ['plans', z.array(planSchema), mocks.plans],
    ['region plans', z.array(planSchema), mocks.regionPlans],
    ['esims', z.array(esimSchema), mocks.esims],
    ['offers', z.array(offerSchema), mocks.offers],
  ] as const)('%s', (_name, schema, data) => {
    expect(() => schema.parse(data)).not.toThrow();
  });
});

describe('mock api', () => {
  const api = createMockApi({ latencyMs: 0 });

  it('filters plans by country', async () => {
    const plans = await api.getPlans('jp');
    expect(plans.map((plan) => plan.id)).toEqual(['jp-3gb-7d', 'jp-10gb-15d', 'jp-20gb-30d']);
  });

  it('throws a 404 for unknown eSIMs', async () => {
    await expect(api.getEsim('0000000000000000000')).rejects.toMatchObject({ status: 404 });
  });
});

describe('scenarios and orders', () => {
  it('returns empty lists in the empty scenario', async () => {
    const api = createMockApi({ latencyMs: 0, scenario: () => 'empty' });
    expect(await api.getEsims()).toEqual([]);
  });

  it('marks active eSIMs low in the lowData scenario', async () => {
    const api = createMockApi({ latencyMs: 0, scenario: () => 'lowData' });
    const [first] = await api.getEsims();
    expect(first && first.data_used_mb / first.data_total_mb).toBeGreaterThan(0.9);
  });

  it('applies coupons, then travel credit, and includes 18% GST in the total', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const { order, payment } = await api.createOrder({ planId: 'jp-10gb-15d', couponCode: 'gulf20' });
    expect(payment).toBeNull();
    expect(order.status).toBe('fulfilled');
    expect(await api.getOrder(order.order_id)).toEqual(order);
    expect(order.subtotal).toBe(1199);
    expect(order.discount).toBe(240);
    expect(order.credit).toBe(300);
    expect(order.total).toBe(659);
    expect(order.tax).toBe(101);
    expect((await api.getEsims())[0]?.iccid).toBe(order.iccid);
  });

  it('rejects unknown coupons', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await expect(api.redeemCoupon('NOPE')).rejects.toMatchObject({ status: 404 });
  });
});
