import { createHmac } from 'node:crypto';
import { priceBreakdown, type Checkout, type Esim, type Order } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { couponRedemption, order, payment } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { JOB, memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/modules/catalog/seed';
import { syncCatalog } from '../src/modules/catalog/sync';
import type { EsimProvider } from '../src/modules/esims/provider';
import { createMockProvider } from '../src/modules/esims/providers/mock';
import { createMemoryPush } from '../src/modules/notifications/push';
import { provisionOrder, refundOrder, type FulfilDeps } from '../src/modules/orders/fulfil';
import { expireStaleOrders } from '../src/modules/orders/service';
import { createMockPayments, MOCK_SIGNATURE } from '../src/modules/payments/mock';
import { createRazorpay } from '../src/modules/payments/razorpay';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv, testKey } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let token: string;

const provider = createMockProvider();

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  await seedReferenceData(db, { sampleContent: true });
  await syncCatalog(db, provider, { marginPercent: 40, logger: silentLogger });
  harness = createTestApp(db);
  token = await signInWithPhone(harness, '+919800000001');
});

afterAll(async () => {
  await close();
});

const auth = (bearer = token) => ({ authorization: `Bearer ${bearer}` });

function post(path: string, body: unknown, headers: Record<string, string> = {}, app = harness.app) {
  return app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

async function checkout(planId: string, key: string, couponCode: string | null = null, bearer = token, app = harness.app) {
  const response = await post('/v1/orders', { plan_id: planId, coupon_code: couponCode }, { ...auth(bearer), 'idempotency-key': key }, app);
  return { response, body: (await response.json()) as Checkout };
}

function fulfilDeps(overrides: Partial<FulfilDeps> = {}): FulfilDeps & { queue: ReturnType<typeof memoryQueue> } {
  return { db, env: testEnv, logger: silentLogger, provider, payments: createMockPayments(), queue: memoryQueue(), push: createMemoryPush(), ...overrides } as FulfilDeps & {
    queue: ReturnType<typeof memoryQueue>;
  };
}

describe('coupons', () => {
  it('validates known codes and rejects unknown or wrong-currency ones', async () => {
    const ok = await post('/v1/coupons/validate', { code: 'gulf20' });
    expect(await ok.json()).toEqual({ code: 'GULF20', discount_pct: 20, discount_amount: null, currency: 'INR' });
    expect((await post('/v1/coupons/validate', { code: 'NOPE' })).status).toBe(422);
    expect((await post('/v1/coupons/validate', { code: 'FIRSTSAIL', currency: 'AED' })).status).toBe(422);
  });
});

describe('checkout', () => {
  it('needs a session and an idempotency key', async () => {
    expect((await post('/v1/orders', { plan_id: 'jp-10gb-15d' }, { 'idempotency-key': 'key-00000001' })).status).toBe(401);
    expect((await post('/v1/orders', { plan_id: 'jp-10gb-15d' }, auth())).status).toBe(400);
  });

  it('prices on the server exactly as the app shows it, and repeats are the same order', async () => {
    const plan = (await (await harness.app.request('/v1/catalog/plans/jp-10gb-15d')).json()) as { price: number };
    const first = await checkout('jp-10gb-15d', 'key-pricing-1', 'GULF20');
    expect(first.response.status).toBe(200);
    const expected = priceBreakdown(plan.price, { code: 'GULF20', discount_pct: 20, discount_amount: null, currency: 'INR' });
    expect(first.body.order).toMatchObject({ status: 'awaiting_payment', plan_id: 'jp-10gb-15d', iccid: null, currency: 'INR', ...expected });
    expect(first.body.order.number).toMatch(/^VL-[A-Z2-9]{8}$/);
    expect(first.body.payment).toMatchObject({ provider: 'mock', amount_minor: Math.round(expected.total * 100), currency: 'INR' });
    const again = await checkout('jp-10gb-15d', 'key-pricing-1', 'GULF20');
    expect(again.body.order.order_id).toBe(first.body.order.order_id);
  });

  it('rejects unknown plans and currencies the payment provider cannot take', async () => {
    expect((await checkout('xx-1gb-1d', 'key-missing-plan')).response.status).toBe(404);
    const razorpayApp = createTestApp(db, { payments: createRazorpay({ keyId: 'rzp_test', keySecret: 's', webhookSecret: 'w' }) }).app;
    const response = await post(
      '/v1/orders',
      { plan_id: 'jp-10gb-15d', currency: 'AED' },
      { ...auth(), 'idempotency-key': 'key-aed-00001' },
      razorpayApp,
    );
    expect(response.status).toBe(422);
  });

  it('confirms a verified payment, queues provisioning once and fulfils the eSIM', async () => {
    const { body } = await checkout('jp-3gb-7d', 'key-happy-path', 'GULF20');
    const id = body.order.order_id;
    const bad = await post(`/v1/orders/${id}/confirm`, { payment_id: 'pay_1', signature: 'forged' }, auth());
    expect(bad.status).toBe(400);

    const sentBefore = harness.queue.sent.length;
    const confirmed = await post(`/v1/orders/${id}/confirm`, { payment_id: 'pay_1', signature: MOCK_SIGNATURE }, auth());
    expect(((await confirmed.json()) as Order).status).toBe('paid');
    await post(`/v1/orders/${id}/confirm`, { payment_id: 'pay_1', signature: MOCK_SIGNATURE }, auth());
    expect(harness.queue.sent.slice(sentBefore)).toEqual([{ name: JOB.provision, data: { orderId: id } }]);

    await provisionOrder(fulfilDeps(), id, { finalAttempt: false });
    const status = (await (await harness.app.request(`/v1/orders/${id}`, { headers: auth() })).json()) as Order;
    expect(status.status).toBe('fulfilled');
    expect(status.iccid).toMatch(/^\d{19}$/);

    const esims = (await (await harness.app.request('/v1/esims', { headers: auth() })).json()) as Esim[];
    expect(esims[0]).toMatchObject({ iccid: status.iccid, plan_id: 'jp-3gb-7d', status: 'not_started', country_codes: ['JP'], qr_url: null });
    expect(esims[0]?.lpa_string).toMatch(/^LPA:1\$smdp\.mock\.vela\.invalid\$K2-/);
    const one = await harness.app.request(`/v1/esims/${status.iccid}`, { headers: auth() });
    expect(one.status).toBe(200);

    expect(await db.select().from(couponRedemption).where(eq(couponRedemption.orderId, id))).toHaveLength(1);
    expect((await checkout('jp-20gb-30d', 'key-coupon-reuse', 'GULF20')).response.status).toBe(422);
  });

  it('keeps orders and eSIMs private to their owner', async () => {
    const { body } = await checkout('th-3gb-7d', 'key-private-1');
    const stranger = await signInWithPhone(harness, '+971500000002');
    expect((await harness.app.request(`/v1/orders/${body.order.order_id}`, { headers: auth(stranger) })).status).toBe(404);
    expect(await (await harness.app.request('/v1/esims', { headers: auth(stranger) })).json()).toEqual([]);
    expect((await harness.app.request('/v1/orders/not-a-uuid', { headers: auth() })).status).toBe(404);
  });
});

describe('provisioning failures', () => {
  it('retries, then marks the order failed and refunds the payment', async () => {
    const { body } = await checkout('jp-10gb-15d', 'key-failure-1');
    const id = body.order.order_id;
    await post(`/v1/orders/${id}/confirm`, { payment_id: 'pay_fail', signature: MOCK_SIGNATURE }, auth());

    const broken: EsimProvider = { ...provider, purchase: async () => Promise.reject(new Error('provider down')) };
    const refunds: string[] = [];
    const payments = { ...createMockPayments(), refund: async ({ orderId }: { orderId: string }) => (refunds.push(orderId), { refundId: 'r1' }) };
    const deps = fulfilDeps({ provider: broken, payments });

    await expect(provisionOrder(deps, id, { finalAttempt: false })).rejects.toThrow('provider down');
    await provisionOrder(deps, id, { finalAttempt: true });
    const [failed] = await db.select().from(order).where(eq(order.id, id));
    expect(failed).toMatchObject({ status: 'provisioning_failed', failureReason: 'provider down' });
    expect(deps.queue.sent).toEqual([{ name: JOB.refund, data: { orderId: id } }]);

    await refundOrder(deps, id);
    expect(refunds).toEqual([id]);
    const [refunded] = await db.select().from(order).where(eq(order.id, id));
    expect(refunded?.status).toBe('refunded');
    const [paid] = await db.select().from(payment).where(eq(payment.orderId, id));
    expect(paid?.status).toBe('refunded');
  });

  it('expires unpaid orders after 30 minutes but still honours a late payment', async () => {
    const { body } = await checkout('th-3gb-7d', 'key-expiry-01');
    const id = body.order.order_id;
    await db.update(order).set({ createdAt: new Date(Date.now() - 31 * 60_000) }).where(eq(order.id, id));
    expect(await expireStaleOrders(db)).toBeGreaterThanOrEqual(1);
    const expired = (await (await harness.app.request(`/v1/orders/${id}`, { headers: auth() })).json()) as Order;
    expect(expired.status).toBe('expired');
    const late = await post(`/v1/orders/${id}/confirm`, { payment_id: 'pay_late', signature: MOCK_SIGNATURE }, auth());
    expect(((await late.json()) as Order).status).toBe('paid');
  });
});

describe('Razorpay', () => {
  const keySecret = 'rzp-key-secret';
  const webhookSecret = 'rzp-webhook-secret';
  const sign = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');
  let created = 0;
  const razorpay = createRazorpay({
    keyId: 'rzp_test_key',
    keySecret,
    webhookSecret,
    fetch: async () => new Response(JSON.stringify({ id: `order_rzp_${++created}` }), { status: 200 }),
  });

  it('verifies the checkout signature with the key secret', () => {
    expect(razorpay.verifyClientResult({ providerOrderId: 'order_1', paymentId: 'pay_1', signature: sign(keySecret, 'order_1|pay_1') })).toBe(true);
    expect(razorpay.verifyClientResult({ providerOrderId: 'order_1', paymentId: 'pay_2', signature: sign(keySecret, 'order_1|pay_1') })).toBe(false);
  });

  it('marks the order paid from a signed webhook, once, and ignores bad signatures', async () => {
    const live = createTestApp(db, { payments: razorpay });
    const bearer = await signInWithPhone(live, '+919800000003');
    const { body } = await checkout('jp-10gb-15d', 'key-webhook-01', null, bearer, live.app);
    expect(body.payment).toMatchObject({ provider: 'razorpay', key: 'rzp_test_key' });
    const providerOrderId = body.payment?.provider_order_id ?? '';
    const event = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh_1', order_id: providerOrderId, amount: body.payment?.amount_minor } } },
    });
    const send = (signature: string) =>
      live.app.request('/v1/webhooks/razorpay', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'evt_1' },
        body: event,
      });

    expect((await send('bad')).status).toBe(400);
    expect(await (await send(sign(webhookSecret, event))).json()).toEqual({ ok: true, duplicate: false });
    expect(await (await send(sign(webhookSecret, event))).json()).toEqual({ ok: true, duplicate: true });
    expect(live.queue.sent).toEqual([{ name: JOB.provision, data: { orderId: body.order.order_id } }]);
    const [row] = await db.select().from(order).where(eq(order.id, body.order.order_id));
    expect(row?.status).toBe('paid');
  });

  it('does not mark an order paid when the captured amount is wrong', async () => {
    const live = createTestApp(db, { payments: razorpay });
    const bearer = await signInWithPhone(live, '+919800000004');
    const { body } = await checkout('th-3gb-7d', 'key-webhook-02', null, bearer, live.app);
    const event = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh_2', order_id: body.payment?.provider_order_id, amount: 100 } } },
    });
    await live.app.request('/v1/webhooks/razorpay', {
      method: 'POST',
      headers: { 'x-razorpay-signature': sign(webhookSecret, event), 'x-razorpay-event-id': 'evt_2' },
      body: event,
    });
    const [row] = await db.select().from(order).where(eq(order.id, body.order.order_id));
    expect(row?.status).toBe('awaiting_payment');
  });
});

describe('payment settings', () => {
  const base = { DATABASE_URL: 'postgres://x', ENCRYPTION_KEY: testKey, BETTER_AUTH_SECRET: 'x'.repeat(32) };
  it('refuses mock payments in production and Razorpay without keys', () => {
    expect(() => loadEnv({ ...base, APP_ENV: 'production' })).toThrow(/production must take real payments/);
    expect(() => loadEnv({ ...base, PAYMENT_PROVIDER: 'razorpay' })).toThrow(/Razorpay needs/);
  });
});
