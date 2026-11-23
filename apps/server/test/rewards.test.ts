import type { Checkout, Order, Rewards, TopUpPack } from '@vela/api';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { creditLedger, esim, esimNotice, order, profile, user } from '../src/db/schema';
import { JOB, memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/modules/catalog/seed';
import { syncCatalog } from '../src/modules/catalog/sync';
import type { EsimProvider } from '../src/modules/esims/provider';
import { createMockProvider, mockUsage } from '../src/modules/esims/providers/mock';
import { syncEsimUsage } from '../src/modules/esims/usage';
import { createMemoryPush } from '../src/modules/notifications/push';
import { provisionOrder, refundOrder, type FulfilDeps } from '../src/modules/orders/fulfil';
import { createMockPayments, MOCK_SIGNATURE } from '../src/modules/payments/mock';
import { creditBalance } from '../src/modules/rewards/credit';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv } from './helpers';

const MIN = 60_000;
const DAY = 86_400_000;

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let asha: string;
let ben: string;
let clock = Date.now();

const provider = createMockProvider({ now: () => clock });
const push = createMemoryPush();

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  await seedReferenceData(db, { sampleContent: true });
  await syncCatalog(db, provider, { marginPercent: 40, logger: silentLogger });
  harness = createTestApp(db);
  asha = await signInWithPhone(harness, '+919822200001');
  ben = await signInWithPhone(harness, '+919822200002');
});

afterAll(async () => {
  await close();
});

const headers = (bearer: string, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${bearer}`, 'content-type': 'application/json', ...extra });
const get = async <T>(path: string, bearer: string) => (await harness.app.request(path, { headers: headers(bearer) })).json() as Promise<T>;
const post = (path: string, body: unknown, bearer: string, extra: Record<string, string> = {}) =>
  harness.app.request(path, { method: 'POST', headers: headers(bearer, extra), body: JSON.stringify(body) });

function deps(overrides: Partial<FulfilDeps> = {}): FulfilDeps {
  return { db, env: testEnv, logger: silentLogger, provider, payments: createMockPayments(), queue: memoryQueue(), push, ...overrides };
}

async function userIdFor(phone: string) {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
  return row?.id ?? '';
}

async function buy(bearer: string, planId: string, key: string, couponCode: string | null = null) {
  const response = await post('/v1/orders', { plan_id: planId, coupon_code: couponCode }, bearer, { 'idempotency-key': key });
  const checkout = (await response.json()) as Checkout;
  if (response.status !== 200) return { status: response.status, checkout };
  if (checkout.payment) {
    await post(`/v1/orders/${checkout.order.order_id}/confirm`, { payment_id: `pay_${key}`, signature: MOCK_SIGNATURE }, bearer);
  }
  await provisionOrder(deps(), checkout.order.order_id, { finalAttempt: false });
  const final = await get<Order>(`/v1/orders/${checkout.order.order_id}`, bearer);
  return { status: response.status, checkout, final };
}

async function topUp(bearer: string, iccid: string, packId: string, key: string) {
  const checkout = (await (await post(`/v1/esims/${iccid}/top-ups`, { pack_id: packId }, bearer, { 'idempotency-key': key })).json()) as Checkout;
  await post(`/v1/orders/${checkout.order.order_id}/confirm`, { payment_id: `pay_${key}`, signature: MOCK_SIGNATURE }, bearer);
  await provisionOrder(deps(), checkout.order.order_id, { finalAttempt: false });
  return { checkout, final: await get<Order>(`/v1/orders/${checkout.order.order_id}`, bearer) };
}

describe('referrals', () => {
  it('lets a friend use a referral code once, on their first eSIM only, and never your own', async () => {
    const rewards = await get<Rewards>('/v1/rewards', asha);
    expect(rewards).toMatchObject({ balance: 0, currency: 'INR', trips: 0, referrals: [] });
    const code = rewards.code;

    expect((await post('/v1/coupons/validate', { code }, asha)).status).toBe(422);
    expect(await (await post('/v1/coupons/validate', { code: code.toLowerCase() }, ben)).json()).toEqual({
      code,
      discount_pct: null,
      discount_amount: 150,
      currency: 'INR',
    });

    const first = await buy(ben, 'jp-3gb-7d', 'ben-first-0001', code);
    expect(first.final).toMatchObject({ status: 'fulfilled', discount: 150 });
    const [benProfile] = await db.select().from(profile).where(eq(profile.userId, await userIdFor('+919822200002')));
    expect(benProfile?.referredBy).toBe(await userIdFor('+919822200001'));
    expect((await buy(ben, 'th-3gb-7d', 'ben-second-001', code)).status).toBe(422);

    const friends = await get<Rewards>('/v1/rewards', asha);
    expect(friends.referrals).toEqual([{ id: await userIdFor('+919822200002'), name: '••0002', status: 'joined', reward: 0 }]);
  });

  it('credits the referrer once, when the friend’s eSIM first connects', async () => {
    const [benEsim] = await db.select().from(esim).where(eq(esim.userId, await userIdFor('+919822200002')));
    if (!benEsim) throw new Error('no eSIM');
    const usageDeps = { db, logger: silentLogger, provider, push, now: () => new Date(clock) };
    clock = benEsim.createdAt.getTime() + 2 * MIN;
    await syncEsimUsage(usageDeps, benEsim.id);
    expect(await creditBalance(db, await userIdFor('+919822200001'), 'INR')).toBe(0);

    clock = benEsim.createdAt.getTime() + 10 * MIN;
    await syncEsimUsage(usageDeps, benEsim.id);
    clock = benEsim.createdAt.getTime() + 20 * MIN;
    await syncEsimUsage(usageDeps, benEsim.id);
    const rewards = await get<Rewards>('/v1/rewards', asha);
    expect(rewards.balance).toBe(150);
    expect(rewards.referrals[0]).toMatchObject({ status: 'travelled', reward: 150 });
  });
});

describe('travel credit', () => {
  it('applies itself at checkout and is spent when the order is paid', async () => {
    const plan = await get<{ price: number }>('/v1/catalog/plans/jp-10gb-15d', asha);
    const bought = await buy(asha, 'jp-10gb-15d', 'asha-credit-001');
    expect(bought.checkout.order).toMatchObject({ subtotal: plan.price, credit: 150, total: plan.price - 150 });
    expect(bought.checkout.payment?.amount_minor).toBe((plan.price - 150) * 100);
    expect(bought.final?.status).toBe('fulfilled');
    expect((await get<Rewards>('/v1/rewards', asha)).balance).toBe(0);
  });

  it('comes back when a failed order is refunded', async () => {
    const ashaId = await userIdFor('+919822200001');
    await db.insert(creditLedger).values({ userId: ashaId, amountMinor: 20_000, currency: 'INR', reason: 'goodwill' });
    const response = await post('/v1/orders', { plan_id: 'jp-20gb-30d' }, asha, { 'idempotency-key': 'asha-refund-01' });
    const { order: created } = (await response.json()) as Checkout;
    expect(created.credit).toBe(200);
    await post(`/v1/orders/${created.order_id}/confirm`, { payment_id: 'pay_r', signature: MOCK_SIGNATURE }, asha);
    expect(await creditBalance(db, ashaId, 'INR')).toBe(0);
    const broken: EsimProvider = { ...provider, purchase: () => Promise.reject(new Error('down')) };
    await provisionOrder(deps({ provider: broken }), created.order_id, { finalAttempt: true });
    await refundOrder(deps(), created.order_id);
    await refundOrder(deps(), created.order_id);
    expect(await creditBalance(db, ashaId, 'INR')).toBe(20_000);
  });

  it('pays for the whole order when there is enough, with no payment step', async () => {
    const ashaId = await userIdFor('+919822200001');
    await db.insert(creditLedger).values({ userId: ashaId, amountMinor: 500_000, currency: 'INR', reason: 'goodwill' });
    const sentBefore = harness.queue.sent.length;
    const response = await post('/v1/orders', { plan_id: 'th-3gb-7d' }, asha, { 'idempotency-key': 'asha-free-0001' });
    const checkout = (await response.json()) as Checkout;
    expect(checkout.payment).toBeNull();
    expect(checkout.order).toMatchObject({ status: 'paid', total: 0, tax: 0 });
    expect(harness.queue.sent.slice(sentBefore)).toEqual([{ name: JOB.provision, data: { orderId: checkout.order.order_id } }]);
    await db.delete(creditLedger).where(and(eq(creditLedger.userId, ashaId), eq(creditLedger.reason, 'goodwill')));
    await db.insert(creditLedger).values({ userId: ashaId, amountMinor: -(await creditBalance(db, ashaId, 'INR')), currency: 'INR', reason: 'reset' });
  });
});

describe('top-ups', () => {
  it('lists packs from the catalog for the eSIM’s plan', async () => {
    const [mine] = await get<{ iccid: string; plan_id: string }[]>('/v1/esims', asha);
    const packs = await get<TopUpPack[]>(`/v1/esims/${mine?.iccid}/top-ups`, asha);
    expect(packs.map((pack) => [pack.data_mb, pack.extra_days, pack.price])).toEqual([
      [1024, 0, 199],
      [3072, 0, 449],
      [5120, 7, 649],
    ]);
    expect(packs[0]?.id).toBe(`${mine?.plan_id}-topup-1gb`);
  });

  it('adds data to the same eSIM, brings a used-up eSIM back and resets its warnings', async () => {
    const [target] = await db.select().from(esim).where(and(eq(esim.userId, await userIdFor('+919822200001')), eq(esim.planId, 'jp-10gb-15d')));
    if (!target) throw new Error('no eSIM');
    const expiresAt = new Date(Date.now() + 2 * DAY);
    await db.update(esim).set({ status: 'depleted', dataUsedMb: target.dataTotalMb, activatedAt: new Date(), expiresAt }).where(eq(esim.id, target.id));
    await db.insert(esimNotice).values([{ esimId: target.id, kind: 'depleted' }, { esimId: target.id, kind: 'low_data' }, { esimId: target.id, kind: 'ready' }]).onConflictDoNothing();

    const small = await topUp(asha, target.iccid, 'jp-10gb-15d-topup-1gb', 'asha-topup-0001');
    expect(small.checkout.order).toMatchObject({ kind: 'top_up', subtotal: 199, iccid: target.iccid });
    expect(small.final.status).toBe('fulfilled');
    const [after] = await db.select().from(esim).where(eq(esim.id, target.id));
    expect(after).toMatchObject({ status: 'active', dataTotalMb: target.dataTotalMb + 1024 });
    expect((await db.select().from(esimNotice).where(eq(esimNotice.esimId, target.id))).map((item) => item.kind)).toEqual(['ready']);

    await topUp(asha, target.iccid, 'jp-10gb-15d-topup-5gb-7d', 'asha-topup-0002');
    const [extended] = await db.select().from(esim).where(eq(esim.id, target.id));
    expect(extended?.dataTotalMb).toBe(target.dataTotalMb + 1024 + 5120);
    expect(extended?.expiresAt?.getTime()).toBe(expiresAt.getTime() + 7 * DAY);

    await provisionOrder(deps(), small.checkout.order.order_id, { finalAttempt: false });
    const [again] = await db.select().from(esim).where(eq(esim.id, target.id));
    expect(again?.dataTotalMb).toBe(extended?.dataTotalMb);
  });

  it('refuses packs from another plan, other people’s eSIMs and expired eSIMs', async () => {
    const [target] = await db.select().from(esim).where(and(eq(esim.userId, await userIdFor('+919822200001')), eq(esim.planId, 'jp-10gb-15d')));
    const wrong = await post(`/v1/esims/${target?.iccid}/top-ups`, { pack_id: 'th-3gb-7d-topup-1gb' }, asha, { 'idempotency-key': 'asha-wrong-0001' });
    expect(wrong.status).toBe(422);
    expect((await harness.app.request(`/v1/esims/${target?.iccid}/top-ups`, { headers: headers(ben) })).status).toBe(404);
    await db.update(esim).set({ status: 'expired' }).where(eq(esim.id, target?.id ?? ''));
    expect(await get<TopUpPack[]>(`/v1/esims/${target?.iccid}/top-ups`, asha)).toEqual([]);
    const [paidTopUps] = await db.select().from(order).where(and(eq(order.kind, 'top_up'), eq(order.status, 'fulfilled')));
    expect(paidTopUps?.esimId).toBe(target?.id);
  });

  it('keeps burning data at the plan’s pace after a top-up, and pushes the expiry out', () => {
    const query = { iccid: '1', providerRef: 'r', purchasedAt: new Date(0), planMb: 10_240, totalMb: 10_240, validityDays: 10, extraDays: 0 };
    const now = 5 * MIN + 5 * DAY;
    const before = mockUsage(query, now, 1);
    const after = mockUsage({ ...query, totalMb: 15_360, extraDays: 7 }, now, 1);
    expect(after.usedMb).toBe(before.usedMb);
    expect((after.expiresAt?.getTime() ?? 0) - (before.expiresAt?.getTime() ?? 0)).toBe(7 * DAY);
  });
});
