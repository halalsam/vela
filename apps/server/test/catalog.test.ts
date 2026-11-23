import { createHttpApi, createMockApi } from '@vela/api';
import { countries as mockCountries, plans as mockPlans } from '@vela/api/mocks';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { plan, planPrice } from '../src/db/schema';
import { charmPrice, planSlug, retailPrices, uniqueId } from '../src/modules/catalog/pricing';
import { seedReferenceData } from '../src/modules/catalog/seed';
import { syncCatalog } from '../src/modules/catalog/sync';
import type { EsimProvider, ProviderPlan } from '../src/modules/esims/provider';
import { createMockProvider } from '../src/modules/esims/providers/mock';
import { createTestApp, createTestDb, silentLogger } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
const provider = createMockProvider();
const sync = (source: EsimProvider = provider) => syncCatalog(db, source, { marginPercent: 40, logger: silentLogger });

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  await seedReferenceData(db, { sampleContent: true });
});

afterAll(async () => {
  await close();
});

const app = () => createTestApp(db).app;
const httpApi = (currency: 'INR' | 'AED' = 'INR') =>
  createHttpApi({
    baseUrl: 'http://vela.test/',
    fallback: createMockApi({ latencyMs: 0 }),
    currency: () => currency,
    fetch: (url, init) => Promise.resolve(app().request(url, init)),
  });

describe('pricing', () => {
  it('rounds INR to the next ₹…99 band and other currencies to .99', () => {
    expect(charmPrice(84000, 'INR')).toBe(84900);
    expect(charmPrice(119900, 'INR')).toBe(119900);
    expect(charmPrice(1000, 'INR')).toBe(4900);
    expect(charmPrice(1820, 'AED')).toBe(1899);
  });

  it('prefers the provider suggested retail price, else applies the margin', () => {
    const cost = { amountMinor: 50000, currency: 'INR' as const };
    expect(retailPrices({ cost, suggestedRetail: [{ amountMinor: 59900, currency: 'INR' }] }, 40)).toEqual([
      { currency: 'INR', amountMinor: 59900 },
    ]);
    expect(retailPrices({ cost, suggestedRetail: [] }, 40)).toEqual([{ currency: 'INR', amountMinor: 74900 }]);
  });

  it('builds stable slugs and avoids collisions', () => {
    expect(planSlug({ type: 'country', countryCodes: ['JP'], regionRef: null, dataMb: 10240, validityDays: 15 })).toBe('jp-10gb-15d');
    expect(planSlug({ type: 'regional', countryCodes: ['JP'], regionRef: 'asia', dataMb: 512, validityDays: 7 })).toBe('asia-512mb-7d');
    expect(uniqueId('jp-1gb-7d', new Set(['jp-1gb-7d', 'jp-1gb-7d-2']))).toBe('jp-1gb-7d-3');
  });
});

describe('catalog sync', () => {
  it('creates every provider plan with a price, then updates idempotently', async () => {
    const first = await sync();
    expect(first.created).toBe(mockPlans.length + 12);
    const second = await sync();
    expect(second).toMatchObject({ created: 0, updated: first.created, deactivated: 0, total: first.created });
  });

  it('keeps manual price overrides', async () => {
    await db.update(planPrice).set({ amountMinor: 99900, manual: true }).where(eq(planPrice.planId, 'jp-10gb-15d'));
    await sync();
    const [price] = await db.select().from(planPrice).where(eq(planPrice.planId, 'jp-10gb-15d'));
    expect(price?.amountMinor).toBe(99900);
    await db.update(planPrice).set({ amountMinor: 119900, manual: false }).where(eq(planPrice.planId, 'jp-10gb-15d'));
  });

  it('deactivates plans the provider stops selling, and revives them', async () => {
    const all = await provider.listPlans();
    const shrunk: EsimProvider = { name: 'shrunk', listPlans: async () => all.filter((item: ProviderPlan) => item.ref !== 'th-3gb-7d') };
    expect((await sync(shrunk)).deactivated).toBe(1);
    const [row] = await db.select().from(plan).where(eq(plan.id, 'th-3gb-7d'));
    expect(row?.active).toBe(false);
    await sync();
    const [revived] = await db.select().from(plan).where(eq(plan.id, 'th-3gb-7d'));
    expect(revived?.active).toBe(true);
  });
});

describe('catalog API through the shared client', () => {
  it('serves the same plans the app knows from the mocks', async () => {
    const api = httpApi();
    const plans = await api.getPlans('jp');
    expect(plans.map((item) => item.id)).toEqual(['jp-3gb-7d', 'jp-10gb-15d', 'jp-20gb-30d']);
    expect(plans[1]).toMatchObject({ price: 1199, currency: 'INR', is_5g: true, networks: ['NTT Docomo', 'SoftBank'] });
    expect(await api.getPlan('jp-10gb-15d')).toEqual(plans[1]);
  });

  it('lists countries with from-prices and regions with their members', async () => {
    const api = httpApi();
    const countries = await api.getCountries();
    expect(countries).toHaveLength(mockCountries.length);
    expect(countries.find((item) => item.code === 'TH')).toMatchObject({ from_price: 399, popular: true, region: 'asia' });
    const regions = await api.getRegions();
    expect(regions.map((item) => item.id).sort()).toEqual(['asia', 'europe', 'global', 'gulf']);
    expect(regions.find((item) => item.id === 'gulf')?.country_codes).toEqual(expect.arrayContaining(['AE', 'SA', 'QA']));
    expect((await api.getRegionPlans('asia')).every((item) => item.type === 'regional')).toBe(true);
  });

  it('serves offers and 404s unknown plans', async () => {
    const api = httpApi();
    expect(await api.getOffers()).toHaveLength(3);
    await expect(api.getPlan('nope')).rejects.toMatchObject({ status: 404, message: 'Plan not found' });
  });

  it('returns nothing for a currency without prices yet', async () => {
    expect(await httpApi('AED').getCountries()).toEqual([]);
  });

  it('caches catalog responses and validates input', async () => {
    const response = await app().request('/v1/catalog/plans?country=JP');
    expect(response.headers.get('cache-control')).toContain('max-age=300');
    const tag = response.headers.get('etag');
    expect(tag).toBeTruthy();
    const again = await app().request('/v1/catalog/plans?country=JP', { headers: { 'if-none-match': tag ?? '' } });
    expect(again.status).toBe(304);
    expect((await app().request('/v1/catalog/plans?country=JPN')).status).toBe(400);
    expect((await app().request('/v1/catalog/countries?currency=EUR')).status).toBe(400);
  });

  it('documents the catalog in OpenAPI', async () => {
    const doc = (await (await app().request('/v1/openapi.json')).json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/v1/catalog/countries', '/v1/catalog/regions', '/v1/catalog/plans', '/v1/catalog/plans/{id}', '/v1/offers']),
    );
  });
});
