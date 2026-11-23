import type { Checkout, DailyUsage } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { device, esim, liveActivity, usageSnapshot } from '../src/db/schema';
import { memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/modules/catalog/seed';
import { syncCatalog } from '../src/modules/catalog/sync';
import { createMockProvider, mockUsage } from '../src/modules/esims/providers/mock';
import { noticesDue, syncEsimUsage, syncTrackedEsims } from '../src/modules/esims/usage';
import { appleDate, tripContentState } from '../src/modules/notifications/notify';
import { createMemoryPush } from '../src/modules/notifications/push';
import { provisionOrder } from '../src/modules/orders/fulfil';
import { createMockPayments, MOCK_SIGNATURE } from '../src/modules/payments/mock';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv } from './helpers';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let token: string;
let clock = Date.now();

const provider = createMockProvider({ now: () => clock });
const push = createMemoryPush();
const usageDeps = () => ({ db, logger: silentLogger, provider, push, now: () => new Date(clock) });

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  await seedReferenceData(db, { sampleContent: true });
  await syncCatalog(db, provider, { marginPercent: 40, logger: silentLogger });
  harness = createTestApp(db);
  token = await signInWithPhone(harness, '+919811100001');
});

afterAll(async () => {
  await close();
});

const auth = (bearer = token) => ({ authorization: `Bearer ${bearer}`, 'content-type': 'application/json' });
const send = (method: string, path: string, body?: unknown, bearer = token) =>
  harness.app.request(path, { method, headers: auth(bearer), body: body === undefined ? undefined : JSON.stringify(body) });

async function buyEsim(planId: string, key: string) {
  const created = (await (await harness.app.request('/v1/orders', {
    method: 'POST',
    headers: { ...auth(), 'idempotency-key': key },
    body: JSON.stringify({ plan_id: planId }),
  })).json()) as Checkout;
  await send('POST', `/v1/orders/${created.order.order_id}/confirm`, { payment_id: `pay_${key}`, signature: MOCK_SIGNATURE });
  await provisionOrder(
    { db, env: testEnv, logger: silentLogger, provider, payments: createMockPayments(), queue: memoryQueue(), push },
    created.order.order_id,
    { finalAttempt: false },
  );
  const [row] = await db.select().from(esim).where(eq(esim.userId, (await db.select().from(device))[0]?.userId ?? ''));
  return { orderId: created.order.order_id, row };
}

describe('mock usage', () => {
  const query = { iccid: '1', providerRef: 'r', purchasedAt: new Date(0), totalMb: 10_240, validityDays: 10 };
  it('starts a few minutes after purchase, then burns data and depletes before the plan ends', () => {
    expect(mockUsage(query, 2 * MIN, 1).status).toBe('not_started');
    const day5 = mockUsage(query, 5 * MIN + 5 * DAY, 1);
    expect(day5.status).toBe('active');
    expect(day5.usedMb).toBeCloseTo(10_240 * 1.05 * 0.5, -1);
    expect(day5.expiresAt?.getTime()).toBe(5 * MIN + 10 * DAY);
    expect(mockUsage(query, 5 * MIN + 9.9 * DAY, 1).status).toBe('depleted');
  });

  it('runs faster on staging when asked', () => {
    expect(mockUsage(query, (5 * MIN + 5 * DAY) / 1440, 1440).usedMb).toBeCloseTo(mockUsage(query, 5 * MIN + 5 * DAY, 1).usedMb, -1);
  });
});

describe('notice rules', () => {
  const now = new Date(1_000 * DAY);
  const base = { status: 'active' as const, dataUsedMb: 1000, dataTotalMb: 10_240, expiresAt: new Date(now.getTime() + 5 * DAY) };
  it('warns on low data, 24 hours and 2 hours before expiry, and when data runs out', () => {
    expect(noticesDue(base, 15, now)).toEqual([]);
    expect(noticesDue({ ...base, dataUsedMb: 9000 }, 15, now)).toEqual(['low_data']);
    expect(noticesDue({ ...base, expiresAt: new Date(now.getTime() + 20 * HOUR) }, 15, now)).toEqual(['expiry_24h']);
    expect(noticesDue({ ...base, expiresAt: new Date(now.getTime() + HOUR) }, 15, now)).toEqual(['expiry_2h']);
    expect(noticesDue({ ...base, status: 'depleted', dataUsedMb: 10_240 }, 15, now)).toEqual(['depleted']);
    expect(noticesDue({ ...base, status: 'not_started' }, 15, now)).toEqual([]);
  });

  it('skips the 24-hour warning on very short plans', () => {
    expect(noticesDue({ ...base, expiresAt: new Date(now.getTime() + 20 * HOUR) }, 1, now)).toEqual([]);
  });
});

describe('devices and pushes', () => {
  it('registers devices, and pushes "ready" in each device’s language after provisioning', async () => {
    expect((await send('POST', '/v1/devices', { platform: 'ios', push_token: 'ios-token-0001', locale: 'en' })).status).toBe(204);
    expect((await send('POST', '/v1/devices', { platform: 'android', push_token: 'fcm-token-0001', locale: 'ar' })).status).toBe(204);
    expect((await send('POST', '/v1/devices', { platform: 'ios', push_token: 'ios-token-0001', locale: 'en-IN' })).status).toBe(204);
    expect(await db.select().from(device)).toHaveLength(2);

    const { row } = await buyEsim('jp-10gb-15d', 'usage-buy-0001');
    expect(row?.iccid).toBeTruthy();
    const ready = push.sent.filter((item) => item.kind === 'notify');
    expect(ready.map((item) => item.kind === 'notify' && [item.platform, item.message.title])).toEqual([
      ['ios', 'Your Japan eSIM is ready'],
      ['android', 'شريحة اليابان جاهزة'],
    ]);
    expect(ready[0]?.kind === 'notify' && ready[0].message.data).toEqual({ kind: 'ready', iccid: row?.iccid });
  });

  it('keeps Live Activities current, warns once on low data, and ends them when data runs out', async () => {
    const [row] = await db.select().from(esim);
    if (!row) throw new Error('no eSIM');
    expect(
      (await send('POST', `/v1/esims/${row.iccid}/live-activity`, { push_token: 'la-token-0001', locale: 'ar', device_token: 'ios-token-0001' })).status,
    ).toBe(204);
    push.sent.length = 0;

    clock = row.createdAt.getTime() + 5 * MIN + 2 * DAY;
    const first = await syncEsimUsage(usageDeps(), row.id);
    expect(first).toEqual({ changed: true, notices: [] });
    const update = push.sent.find((item) => item.kind === 'liveActivity');
    expect(update?.kind === 'liveActivity' && update.push.event).toBe('update');
    expect(update?.kind === 'liveActivity' && update.push.contentState).toMatchObject({ status: 'active', statusLabel: 'نشطة', totalMB: 10_240 });

    clock = row.createdAt.getTime() + 5 * MIN + 13 * DAY;
    expect((await syncEsimUsage(usageDeps(), row.id)).notices).toEqual(['low_data']);
    expect((await syncEsimUsage(usageDeps(), row.id)).notices).toEqual([]);

    clock = row.createdAt.getTime() + 5 * MIN + 14.9 * DAY;
    push.sent.length = 0;
    expect((await syncEsimUsage(usageDeps(), row.id)).notices).toEqual(['depleted']);
    const ending = push.sent.find((item) => item.kind === 'liveActivity');
    expect(ending?.kind === 'liveActivity' && ending.push.event).toBe('end');
    const [activity] = await db.select().from(liveActivity);
    expect(activity?.endedAt).toBeInstanceOf(Date);
    expect(await syncTrackedEsims(usageDeps(), { limit: 10 })).toEqual({ synced: 0, failed: 0 });
  });

  it('drops devices whose push tokens are no longer valid', async () => {
    const { row } = await buyEsim('th-3gb-7d', 'usage-buy-0002');
    push.invalid.add('fcm-token-0001');
    const fresh = (await db.select().from(esim)).find((item) => item.planId === 'th-3gb-7d');
    expect(row).toBeTruthy();
    clock = (fresh?.createdAt.getTime() ?? 0) + 5 * MIN + 6.95 * DAY;
    await syncEsimUsage(usageDeps(), fresh?.id ?? '');
    expect((await db.select().from(device)).map((item) => item.pushToken)).toEqual(['ios-token-0001']);
  });

  it('unregisters a device and refuses Live Activities for other people’s eSIMs', async () => {
    const [row] = await db.select().from(esim);
    const stranger = await signInWithPhone(harness, '+971500000009');
    const foreign = await send('POST', `/v1/esims/${row?.iccid}/live-activity`, { push_token: 'la-token-0002' }, stranger);
    expect(foreign.status).toBe(404);
    expect((await send('DELETE', '/v1/devices', { push_token: 'ios-token-0001' })).status).toBe(204);
    expect(await db.select().from(device)).toHaveLength(0);
  });
});

describe('daily usage', () => {
  it('turns daily snapshots into data used per day for the last week', async () => {
    const [row] = await db.select().from(esim);
    if (!row) throw new Error('no eSIM');
    await db.delete(usageSnapshot).where(eq(usageSnapshot.esimId, row.id));
    const day = (offset: number) => new Date(Date.now() - offset * DAY).toISOString().slice(0, 10);
    await db.insert(usageSnapshot).values([
      { esimId: row.id, day: day(9), usedMb: 100 },
      { esimId: row.id, day: day(5), usedMb: 600 },
      { esimId: row.id, day: day(4), usedMb: 1100 },
      { esimId: row.id, day: day(1), usedMb: 1500 },
      { esimId: row.id, day: day(0), usedMb: 1800 },
    ]);
    const response = await send('GET', `/v1/esims/${row.iccid}/usage/daily`);
    const days = (await response.json()) as DailyUsage[];
    expect(days.map((item) => item.date)).toEqual([6, 5, 4, 3, 2, 1, 0].map(day));
    expect(days.map((item) => item.used_mb)).toEqual([0, 500, 500, 0, 0, 400, 300]);
  });
});

describe('Live Activity content', () => {
  it('sends dates the way ActivityKit decodes them', () => {
    expect(appleDate(new Date('2001-01-01T00:00:00Z'))).toBe(0);
    const state = tripContentState({ status: 'not_started', dataUsedMb: 0, dataTotalMb: 3072, expiresAt: null }, 'en');
    expect(state).toEqual({ usedMB: 0, totalMB: 3072, status: 'not_started', leftLabel: '3 GB', statusLabel: 'Not started' });
  });
});
