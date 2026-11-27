import type { Checkout } from '@vela/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esim } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { JOB, memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/db/seed';
import { syncCatalog } from '../src/services/catalogSync.service';
import { createMockProvider } from '../src/integrations/esims/mock';
import { queueTrackedEsims } from '../src/services/usage.service';
import { createMemoryPush } from '../src/integrations/push';
import { provisionOrder } from '../src/services/fulfilment.service';
import { createMockPayments, MOCK_SIGNATURE } from '../src/integrations/payments/mock';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv, testKey } from './helpers';

const base = {
  NODE_ENV: 'test',
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://test@localhost/test',
  ENCRYPTION_KEY: testKey,
  LOG_LEVEL: 'silent',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  CORS_ORIGINS: 'http://localhost:3000',
};

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let iccid = '';
let esimId = '';
const provider = createMockProvider();

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  await seedReferenceData(db, { sampleContent: true });
  await syncCatalog(db, provider, { marginPercent: 40, logger: silentLogger });
  const harness = createTestApp(db);
  const token = await signInWithPhone(harness, '+919866600001');
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const created = (await (
    await harness.app.request('/v1/orders', { method: 'POST', headers: { ...headers, 'idempotency-key': 'hook-buy-0001' }, body: JSON.stringify({ plan_id: 'jp-3gb-7d' }) })
  ).json()) as Checkout;
  await harness.app.request(`/v1/orders/${created.order.order_id}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ payment_id: 'pay_hook', signature: MOCK_SIGNATURE }),
  });
  await provisionOrder(
    { db, env: testEnv, logger: silentLogger, provider, payments: createMockPayments(), queue: memoryQueue(), push: createMemoryPush() },
    created.order.order_id,
    { finalAttempt: false },
  );
  const [row] = await db.select().from(esim);
  iccid = row?.iccid ?? '';
  esimId = row?.id ?? '';
});

afterAll(async () => {
  await close();
});

const send = (app: ReturnType<typeof createTestApp>['app'], query: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`/v1/webhooks/esimaccess${query}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('eSIM Access webhooks', () => {
  it('stay closed until a token is configured, and need the right token', async () => {
    expect((await send(createTestApp(db).app, '?token=x', { notifyType: 'CHECK_HEALTH' })).status).toBe(404);
    const harness = createTestApp(db, { env: loadEnv({ ...base, ESIM_ACCESS_WEBHOOK_TOKEN: 'hook-secret' }) });
    expect((await send(harness.app, '?token=wrong', { notifyType: 'CHECK_HEALTH' })).status).toBe(403);
    expect((await send(harness.app, '?token=hook-secret', { notifyType: 'CHECK_HEALTH' })).status).toBe(200);
  });

  it('queue a usage check for the eSIM once per notification', async () => {
    const harness = createTestApp(db, { env: loadEnv({ ...base, ESIM_ACCESS_WEBHOOK_TOKEN: 'hook-secret' }) });
    const event = { notifyType: 'DATA_USAGE', notifyId: 'n-1', eventGenerateTime: '2026-11-24T10:00:00Z', content: { iccid, remain: 100 } };
    expect(await (await send(harness.app, '?token=hook-secret', event)).json()).toEqual({ ok: true, duplicate: false, queued: true });
    expect(await (await send(harness.app, '?token=hook-secret', event)).json()).toEqual({ ok: true, duplicate: true });
    expect(harness.queue.sent).toEqual([{ name: JOB.usageOne, data: { esimId } }]);
    const order = { notifyType: 'ORDER_STATUS', notifyId: 'n-2', content: { orderNo: 'B1', orderStatus: 'GOT_RESOURCE' } };
    expect(await (await send(harness.app, '?token=hook-secret', order)).json()).toMatchObject({ queued: false });
    const unknown = { notifyType: 'ESIM_STATUS', notifyId: 'n-3', content: { esimTranNo: 'nobody', iccid: '0000' } };
    expect(await (await send(harness.app, '?token=hook-secret', unknown)).json()).toMatchObject({ queued: false });
  });

  it('can also require eSIM Access sender addresses', async () => {
    const harness = createTestApp(db, { env: loadEnv({ ...base, ESIM_ACCESS_WEBHOOK_TOKEN: 'hook-secret', ESIM_ACCESS_WEBHOOK_IP_CHECK: 'true' }) });
    expect((await send(harness.app, '?token=hook-secret', { notifyType: 'CHECK_HEALTH' }, { 'x-forwarded-for': '203.0.113.9' })).status).toBe(403);
    expect((await send(harness.app, '?token=hook-secret', { notifyType: 'CHECK_HEALTH' }, { 'x-forwarded-for': '3.1.131.226, 10.0.0.2' })).status).toBe(200);
  });
});

describe('usage checks', () => {
  it('queue one job per tracked eSIM', async () => {
    const queue = memoryQueue();
    expect(await queueTrackedEsims(db, queue, { limit: 100 })).toBe(1);
    expect(queue.sent).toEqual([{ name: JOB.usageOne, data: { esimId } }]);
  });
});
