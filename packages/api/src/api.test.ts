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
