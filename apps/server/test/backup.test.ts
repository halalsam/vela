import type { Checkout, TopUpPack } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esim, order, plan } from '../src/db/schema';
import { memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/db/seed';
import { findBackup, nominalGb, syncCatalog } from '../src/services/catalogSync.service';
import { ProviderUnavailable, type EsimProvider, type ProviderPlan } from '../src/integrations/esims/provider';
import { createEsimGo, toGoPlan, toGoUsage, type GoBundle } from '../src/integrations/esims/esimgo';
import { createMockProvider, mockPurchase } from '../src/integrations/esims/mock';
import { syncEsimUsage } from '../src/services/usage.service';
import { createMemoryPush } from '../src/integrations/push';
import { BackupStateUnknown, provisionOrder, type FulfilDeps } from '../src/services/fulfilment.service';
import { createMockPayments, MOCK_SIGNATURE } from '../src/integrations/payments/mock';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv } from './helpers';

const plan1 = (overrides: Partial<ProviderPlan>): ProviderPlan => ({
  ref: 'x',
  type: 'country',
  regionRef: null,
  countryCodes: ['JP'],
  dataMb: 1024,
  validityDays: 7,
  is5g: false,
  hotspot: true,
  networks: [],
  activation: 'on_first_connection',
  cost: { amountMinor: 100, currency: 'USD' },
  suggestedRetail: [],
  topUps: [],
  ...overrides,
});

describe('matching a backup plan', () => {
  it('compares nominal gigabytes across 1000- and 1024-based suppliers', () => {
    expect([nominalGb(1024), nominalGb(1000), nominalGb(3072), nominalGb(3000), nominalGb(512), nominalGb(500), nominalGb(20480), nominalGb(20000)]).toEqual([
      1, 1, 3, 3, 0.5, 0.5, 20, 20,
    ]);
  });

  it('needs the same data and days, and coverage of every country, preferring the tightest and cheapest', () => {
    const primary = plan1({ countryCodes: ['JP'], dataMb: 3072, validityDays: 15 });
    const candidates = [
      plan1({ ref: 'go-wrong-days', countryCodes: ['JP'], dataMb: 3000, validityDays: 30 }),
      plan1({ ref: 'go-asia', countryCodes: ['JP', 'KR', 'TH'], dataMb: 3000, validityDays: 15, cost: { amountMinor: 50, currency: 'USD' } }),
      plan1({ ref: 'go-jp-dear', countryCodes: ['JP'], dataMb: 3000, validityDays: 15, cost: { amountMinor: 400, currency: 'USD' } }),
      plan1({ ref: 'go-jp', countryCodes: ['JP'], dataMb: 3000, validityDays: 15, cost: { amountMinor: 300, currency: 'USD' } }),
    ];
    expect(findBackup(primary, candidates)?.ref).toBe('go-jp');
    expect(findBackup(plan1({ countryCodes: ['JP', 'CN'], dataMb: 3072, validityDays: 15 }), candidates)).toBeNull();
  });
});

describe('eSIM Go adapter', () => {
  const bundle: GoBundle = {
    name: 'esim_3GB_15D_JP_V2',
    countries: [{ iso: 'JP', name: 'Japan' }],
    roamingEnabled: [],
    dataAmount: 3000,
    duration: 15,
    speed: ['4G', '5G'],
    autostart: true,
    unlimited: false,
    price: 4.25,
    billingType: 'FixedCost',
  };

  it('maps bundles, using roaming countries for regional coverage', () => {
    expect(toGoPlan(bundle)).toMatchObject({ ref: 'esim_3GB_15D_JP_V2', countryCodes: ['JP'], dataMb: 3000, validityDays: 15, is5g: true, cost: { amountMinor: 425 } });
    expect(toGoPlan({ ...bundle, roamingEnabled: [{ iso: 'FR' }, { iso: 'de' }] }).countryCodes).toEqual(['FR', 'DE']);
  });

  it('reports usage against our plan size from their bundle assignments', () => {
    expect(toGoUsage([{ initialQuantity: 3_000_000_000, remainingQuantity: 1_500_000_000, bundleState: 'active', startTime: '2026-11-01T00:00:00Z', endTime: '2026-11-16T00:00:00Z' }], { totalMb: 3072 })).toMatchObject({
      status: 'active',
      usedMb: 1536,
      totalMb: 3072,
      expiresAt: new Date('2026-11-16T00:00:00Z'),
    });
    expect(toGoUsage([{ initialQuantity: 1, remainingQuantity: 1, bundleState: 'queued' }], { totalMb: 1024 }).status).toBe('not_started');
    expect(toGoUsage([{ initialQuantity: 1, remainingQuantity: 0, bundleState: 'depleted' }], { totalMb: 1024 }).status).toBe('depleted');
  });

  it('pages the catalogue, skips unlimited bundles, and buys with the API key', async () => {
    const seen: { url: string; key: string | null; body: unknown }[] = [];
    const request = (async (url: string, init?: RequestInit) => {
      seen.push({ url, key: new Headers(init?.headers).get('X-API-Key'), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.includes('/catalogue')) return Response.json({ bundles: [bundle, { ...bundle, name: 'unl', unlimited: true }], pageCount: 1 });
      if (url.endsWith('/orders')) return Response.json({ orderReference: 'ref-1', order: [{ esims: [] }] });
      if (url.includes('/esims/assignments')) return Response.json([{ iccid: '8944000000000000001', matchingId: 'AB-CD', smdpAddress: 'https://smdp.example.com/' }]);
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    const go = createEsimGo({ apiKey: 'go-key', fetch: request, sleep: async () => undefined });
    expect((await go.listPlans()).map((item) => item.ref)).toEqual(['esim_3GB_15D_JP_V2']);
    expect(await go.purchase({ planRef: 'esim_3GB_15D_JP_V2', idempotencyKey: 'o1' })).toEqual({
      iccid: '8944000000000000001',
      smdp: 'smdp.example.com',
      activationCode: 'AB-CD',
      lpa: 'LPA:1$smdp.example.com$AB-CD',
      providerRef: '8944000000000000001',
    });
    expect(seen.find((call) => call.url.endsWith('/orders'))?.body).toEqual({
      type: 'transaction',
      assign: true,
      order: [{ type: 'bundle', quantity: 1, item: 'esim_3GB_15D_JP_V2', allowReassign: false }],
    });
    expect(seen.every((call) => call.key === 'go-key')).toBe(true);
  });
});

describe('failover to the backup supplier', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>['db'];
  let close: () => Promise<void>;
  let harness: ReturnType<typeof createTestApp>;
  let token: string;
  const mock = createMockProvider();
  const bought: string[] = [];
  const usageCalls: string[] = [];
  const backup: EsimProvider = {
    name: 'backupfake',
    listPlans: async () => (await mock.listPlans()).map((item) => ({ ...item, ref: `go-${item.ref}`, dataMb: Math.round((item.dataMb / 1024) * 1000) })),
    purchase: async ({ planRef, idempotencyKey }) => {
      bought.push(planRef);
      return { ...mockPurchase(planRef, `backup-${idempotencyKey}`), providerRef: `go-${idempotencyKey}` };
    },
    usage: async (query) => {
      usageCalls.push(query.providerRef);
      return { usedMb: 10, totalMb: query.totalMb, status: 'active', activatedAt: new Date(), expiresAt: null };
    },
    topUp: async () => Promise.reject(new Error('no')),
  };
  let refuse: Error | null = null;
  const primary: EsimProvider = { ...mock, purchase: async (input) => (refuse ? Promise.reject(refuse) : mock.purchase(input)) };
  const deps = (): FulfilDeps => ({
    db,
    env: testEnv,
    logger: silentLogger,
    provider: primary,
    backupProvider: backup,
    payments: createMockPayments(),
    queue: memoryQueue(),
    push: createMemoryPush(),
  });

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    await seedReferenceData(db, { sampleContent: true });
    await syncCatalog(db, primary, { marginPercent: 40, logger: silentLogger, backup });
    harness = createTestApp(db);
    token = await signInWithPhone(harness, '+919844400001');
  });

  afterAll(async () => {
    await close();
  });

  async function paidOrder(planId: string, key: string) {
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = (await (
      await harness.app.request('/v1/orders', { method: 'POST', headers: { ...headers, 'idempotency-key': key }, body: JSON.stringify({ plan_id: planId }) })
    ).json()) as Checkout;
    await harness.app.request(`/v1/orders/${created.order.order_id}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payment_id: `pay_${key}`, signature: MOCK_SIGNATURE }),
    });
    return created.order.order_id;
  }

  it('records the supplier on plans and matches backups during sync', async () => {
    const [row] = await db.select().from(plan).where(eq(plan.id, 'jp-10gb-15d'));
    expect(row).toMatchObject({ provider: 'mock', backupProviderRef: 'go-jp-10gb-15d' });
  });

  it('buys from the backup only when the primary definitely refused, and remembers which supplier it used', async () => {
    refuse = new ProviderUnavailable('mock', 'Insufficient account balance');
    const id = await paidOrder('jp-10gb-15d', 'failover-0001');
    await provisionOrder(deps(), id, { finalAttempt: false });
    const [row] = await db.select().from(order).where(eq(order.id, id));
    expect(row?.status).toBe('fulfilled');
    expect(row?.backupAttemptedAt).toBeInstanceOf(Date);
    const [issued] = await db.select().from(esim).where(eq(esim.id, row?.esimId ?? ''));
    expect(issued).toMatchObject({ provider: 'backupfake', providerRef: `go-${id}` });
    expect(bought).toEqual(['go-jp-10gb-15d']);

    await syncEsimUsage({ db, logger: silentLogger, provider: primary, backupProvider: backup, push: createMemoryPush() }, issued?.id ?? '');
    expect(usageCalls).toEqual([`go-${id}`]);
    const packs = (await (await harness.app.request(`/v1/esims/${issued?.iccid}/top-ups`, { headers: { authorization: `Bearer ${token}` } })).json()) as TopUpPack[];
    expect(packs).toEqual([]);
  });

  it('does not switch on errors that might mean the order went through', async () => {
    refuse = new Error('socket hang up');
    const id = await paidOrder('th-3gb-7d', 'failover-0002');
    await expect(provisionOrder(deps(), id, { finalAttempt: false })).rejects.toThrow('socket hang up');
    expect(bought).toHaveLength(1);
  });

  it('never buys from the backup twice for one order', async () => {
    refuse = new ProviderUnavailable('mock', 'No stock');
    const id = await paidOrder('jp-3gb-7d', 'failover-0003');
    await db.update(order).set({ backupAttemptedAt: new Date() }).where(eq(order.id, id));
    await expect(provisionOrder(deps(), id, { finalAttempt: false })).rejects.toBeInstanceOf(BackupStateUnknown);
    expect(bought).toHaveLength(1);
  });

  it('keeps previous backup matches when the backup catalogue is down', async () => {
    const down: EsimProvider = { ...backup, listPlans: () => Promise.reject(new Error('503')) };
    await syncCatalog(db, primary, { marginPercent: 40, logger: silentLogger, backup: down });
    const [row] = await db.select().from(plan).where(eq(plan.id, 'jp-10gb-15d'));
    expect(row?.backupProviderRef).toBe('go-jp-10gb-15d');
  });
});
