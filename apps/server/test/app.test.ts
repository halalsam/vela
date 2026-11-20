import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import type { Database } from '../src/db/client';
import { country, plan, planPrice, region } from '../src/db/schema';
import { createTestDb, silentLogger, testEnv } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
});

afterAll(async () => {
  await close();
});

function app(database: Database = db) {
  return createApp({ db: database, env: testEnv, logger: silentLogger, version: 'test' });
}

describe('system routes', () => {
  it('answers health', async () => {
    const response = await app().request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('reports ready when the database answers', async () => {
    const response = await app().request('/ready');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready', checks: { database: 'ok' } });
  });

  it('reports degraded when the database is down', async () => {
    const broken = { execute: () => Promise.reject(new Error('connection refused')) } as unknown as Database;
    const response = await app(broken).request('/ready');
    expect(response.status).toBe(503);
  });

  it('serves version and an OpenAPI document', async () => {
    const version = await app().request('/v1/version');
    expect(await version.json()).toMatchObject({ version: 'test', env: 'local' });
    const doc = (await (await app().request('/v1/openapi.json')).json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/health', '/ready', '/v1/version']));
  });

  it('returns JSON for unknown routes and sets security headers', async () => {
    const response = await app().request('/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'not_found', message: 'Route not found' } });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});

describe('schema', () => {
  it('applies the migration and stores a priced plan', async () => {
    await db.insert(region).values({ id: 'asia', type: 'regional', nameEn: 'Asia', nameAr: 'آسيا' });
    await db.insert(country).values({ code: 'JP', nameEn: 'Japan', nameAr: 'اليابان', regionId: 'asia', popular: true });
    await db.insert(plan).values({
      id: 'jp-10gb-15d',
      providerPlanRef: 'prov-jp-10',
      type: 'country',
      countryCodes: ['JP'],
      dataMb: 10240,
      validityDays: 15,
      is5g: true,
      networks: ['NTT Docomo', 'SoftBank'],
      costMinor: 70000,
      costCurrency: 'INR',
    });
    await db.insert(planPrice).values({ planId: 'jp-10gb-15d', currency: 'INR', amountMinor: 119900 });
    const [stored] = await db.select().from(plan).where(eq(plan.id, 'jp-10gb-15d'));
    expect(stored).toMatchObject({ dataMb: 10240, activation: 'on_first_connection', hotspot: true, active: true });
  });

  it('rejects duplicate provider refs', async () => {
    await expect(
      db.insert(plan).values({
        id: 'jp-dup',
        providerPlanRef: 'prov-jp-10',
        type: 'country',
        countryCodes: ['JP'],
        dataMb: 1024,
        validityDays: 7,
        costMinor: 1,
        costCurrency: 'INR',
      }),
    ).rejects.toThrow();
  });
});
