import { randomInt } from 'node:crypto';
import { priceBreakdown, taxRateFor, type Checkout, type Coupon, type Order, type OrderStatus, type PaymentResult, type TopUpPack } from '@vela/api';
import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { coupon, couponRedemption, creditLedger, esim, order, payment, plan, profile, topUpPack, topUpPrice, webhookEvent } from '../../db/schema';
import type { Env } from '../../env';
import { JOB, type JobQueue } from '../../jobs/queue';
import { HttpError, notFound } from '../../lib/errors';
import { fromMinor, toMinor, type CurrencyCode } from '../../lib/money';
import type { Logger } from '../../logger';
import { planById } from '../catalog/queries';
import type { PaymentProvider } from '../payments/provider';
import { creditBalance, findReferrer, referralCoupon } from '../rewards/credit';

export type OrderDeps = { db: Database; env: Env; payments: PaymentProvider; queue: JobQueue; logger: Logger };

type OrderRow = typeof order.$inferSelect;
type CouponRow = typeof coupon.$inferSelect;

const NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ORDER_TTL_MINUTES = 30;

function orderNumber(): string {
  return `VL-${Array.from({ length: 8 }, () => NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)]).join('')}`;
}

function publicStatus(status: OrderRow['status']): OrderStatus {
  return status === 'draft' ? 'awaiting_payment' : status;
}

export function couponView(row: CouponRow, currency: CurrencyCode): Coupon {
  return row.kind === 'percent'
    ? { code: row.code, discount_pct: row.value, discount_amount: null, currency }
    : { code: row.code, discount_pct: null, discount_amount: fromMinor(row.value, currency), currency };
}

async function toOrder(db: Database, row: OrderRow): Promise<Order> {
  const [linked] = row.esimId ? await db.select({ iccid: esim.iccid }).from(esim).where(eq(esim.id, row.esimId)) : [];
  return {
    order_id: row.id,
    number: row.number,
    kind: row.kind,
    status: publicStatus(row.status),
    plan_id: row.planId ?? '',
    iccid: linked?.iccid ?? null,
    subtotal: fromMinor(row.subtotalMinor, row.currency),
    discount: fromMinor(row.discountMinor, row.currency),
    credit: fromMinor(row.creditMinor, row.currency),
    tax: fromMinor(row.taxMinor, row.currency),
    total: fromMinor(row.totalMinor, row.currency),
    currency: row.currency,
  };
}

const couponInvalid = () => new HttpError(422, 'coupon_invalid', 'That code can’t be used on this plan');

export async function findCoupon(
  db: Database,
  code: string,
  context: { currency: CurrencyCode; countryCodes?: string[]; userId?: string },
): Promise<CouponRow> {
  const [row] = await db.select().from(coupon).where(eq(coupon.code, code.trim().toUpperCase()));
  if (!row) throw couponInvalid();
  const now = Date.now();
  if ((row.startsAt && row.startsAt.getTime() > now) || (row.endsAt && row.endsAt.getTime() < now)) throw couponInvalid();
  if (row.kind === 'amount' && row.currency !== context.currency) throw couponInvalid();
  if (context.countryCodes && row.countryCodes.length > 0 && !context.countryCodes.some((item) => row.countryCodes.includes(item))) {
    throw couponInvalid();
  }
  if (row.maxRedemptions !== null) {
    const [used] = await db.select({ value: count() }).from(couponRedemption).where(eq(couponRedemption.couponCode, row.code));
    if ((used?.value ?? 0) >= row.maxRedemptions) throw couponInvalid();
  }
  if (context.userId) {
    const [used] = await db
      .select({ value: count() })
      .from(couponRedemption)
      .where(and(eq(couponRedemption.couponCode, row.code), eq(couponRedemption.userId, context.userId)));
    if ((used?.value ?? 0) >= row.perUserLimit) throw couponInvalid();
  }
  return row;
}

type Discount = { view: Coupon; couponCode: string | null; referralCode: string | null };

export async function resolveDiscount(
  db: Database,
  code: string,
  context: { currency: CurrencyCode; countryCodes?: string[]; userId?: string },
): Promise<Discount> {
  try {
    const row = await findCoupon(db, code, context);
    return { view: couponView(row, context.currency), couponCode: row.code, referralCode: null };
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    const referrer = await findReferrer(db, code, context.userId ?? null);
    if (!referrer) throw error;
    return { view: referralCoupon(referrer.referralCode, context.currency), couponCode: null, referralCode: referrer.referralCode };
  }
}

async function checkoutFor(deps: OrderDeps, row: OrderRow): Promise<Checkout> {
  const view = await toOrder(deps.db, row);
  if (view.status !== 'awaiting_payment') return { order: view, payment: null };
  const [latest] = await deps.db.select().from(payment).where(eq(payment.orderId, row.id)).orderBy(desc(payment.createdAt)).limit(1);
  if (!latest) return { order: view, payment: null };
  return {
    order: view,
    payment: {
      provider: latest.provider === 'mock' ? 'mock' : 'razorpay',
      key: deps.payments.publicKey,
      provider_order_id: latest.providerOrderId,
      amount_minor: latest.amountMinor,
      currency: latest.currency,
    },
  };
}

export async function createOrder(
  deps: OrderDeps,
  userId: string,
  input: { planId: string; couponCode: string | null; currency: CurrencyCode },
  idempotencyKey: string,
): Promise<Checkout> {
  const { db, payments } = deps;
  const byKey = and(eq(order.userId, userId), eq(order.idempotencyKey, idempotencyKey));
  const [existing] = await db.select().from(order).where(byKey);
  if (existing) return checkoutFor(deps, existing);

  if (!payments.supports(input.currency)) {
    throw new HttpError(422, 'currency_unsupported', `Payments in ${input.currency} aren’t available yet`);
  }
  const plan = await planById(db, input.planId, input.currency);
  if (!plan) throw notFound('Plan');
  const applied = input.couponCode
    ? await resolveDiscount(db, input.couponCode, { currency: input.currency, countryCodes: plan.country_codes, userId })
    : null;
  const balance = await creditBalance(db, userId, input.currency);
  const totals = priceBreakdown(plan.price, applied?.view ?? null, fromMinor(balance, input.currency), taxRateFor(input.currency));

  const [inserted] = await db
    .insert(order)
    .values({
      number: orderNumber(),
      userId,
      kind: 'esim',
      status: 'awaiting_payment',
      planId: plan.id,
      currency: input.currency,
      subtotalMinor: toMinor(totals.subtotal, input.currency),
      discountMinor: toMinor(totals.discount, input.currency),
      creditMinor: toMinor(totals.credit, input.currency),
      taxMinor: toMinor(totals.tax, input.currency),
      totalMinor: toMinor(totals.total, input.currency),
      couponCode: applied?.couponCode ?? null,
      referralCode: applied?.referralCode ?? null,
      idempotencyKey,
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted) {
    const [raced] = await db.select().from(order).where(byKey);
    if (!raced) throw new Error('Order insert conflicted but no order was found');
    return checkoutFor(deps, raced);
  }

  return collectPayment(deps, inserted);
}

async function collectPayment(deps: OrderDeps, inserted: OrderRow): Promise<Checkout> {
  const { db, payments } = deps;
  if (inserted.totalMinor === 0) {
    await markPaid(deps, inserted.id);
    const [paid] = await db.select().from(order).where(eq(order.id, inserted.id));
    return checkoutFor(deps, paid ?? inserted);
  }

  const created = await payments.createPayment({
    receipt: inserted.number,
    amountMinor: inserted.totalMinor,
    currency: inserted.currency,
    orderId: inserted.id,
  });
  await db.insert(payment).values({
    orderId: inserted.id,
    provider: payments.name,
    providerOrderId: created.providerOrderId,
    amountMinor: inserted.totalMinor,
    currency: inserted.currency,
  });
  deps.logger.info({ orderId: inserted.id, number: inserted.number, total: inserted.totalMinor }, 'order created');
  return checkoutFor(deps, inserted);
}

async function markPaid(deps: OrderDeps, orderId: string): Promise<boolean> {
  const transitioned = await deps.db.transaction(async (tx) => {
    const [paid] = await tx
      .update(order)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(order.id, orderId), inArray(order.status, ['draft', 'awaiting_payment', 'expired'])))
      .returning();
    if (!paid) return false;
    if (paid.couponCode) {
      await tx.insert(couponRedemption).values({ couponCode: paid.couponCode, userId: paid.userId, orderId: paid.id }).onConflictDoNothing();
    }
    if (paid.creditMinor > 0) {
      await tx
        .insert(creditLedger)
        .values({ userId: paid.userId, amountMinor: -paid.creditMinor, currency: paid.currency, reason: 'order', orderId: paid.id })
        .onConflictDoNothing();
    }
    if (paid.referralCode) {
      const [referrer] = await tx.select({ userId: profile.userId }).from(profile).where(eq(profile.referralCode, paid.referralCode));
      if (referrer && referrer.userId !== paid.userId) {
        await tx
          .update(profile)
          .set({ referredBy: referrer.userId, updatedAt: new Date() })
          .where(and(eq(profile.userId, paid.userId), isNull(profile.referredBy)));
      }
    }
    return true;
  });
  if (transitioned) {
    await deps.queue.send(JOB.provision, { orderId }, { singletonKey: orderId });
    deps.logger.info({ orderId }, 'order paid, provisioning queued');
  }
  return transitioned;
}

export async function recordCapture(
  deps: OrderDeps,
  input: { providerOrderId: string; providerPaymentId: string; amountMinor?: number; raw?: unknown },
): Promise<boolean> {
  const [row] = await deps.db
    .select()
    .from(payment)
    .where(and(eq(payment.provider, deps.payments.name), eq(payment.providerOrderId, input.providerOrderId)));
  if (!row) {
    deps.logger.warn({ providerOrderId: input.providerOrderId }, 'capture for an unknown payment');
    return false;
  }
  if (input.amountMinor !== undefined && input.amountMinor !== row.amountMinor) {
    deps.logger.error({ orderId: row.orderId, expected: row.amountMinor, got: input.amountMinor }, 'captured amount does not match the order');
    return false;
  }
  if (row.status !== 'captured' && row.status !== 'refunded') {
    await deps.db
      .update(payment)
      .set({ status: 'captured', providerPaymentId: input.providerPaymentId, raw: input.raw ?? null, updatedAt: new Date() })
      .where(eq(payment.id, row.id));
  }
  return markPaid(deps, row.orderId);
}

async function ownedOrder(db: Database, userId: string, orderId: string): Promise<OrderRow> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw notFound('Order');
  const [row] = await db.select().from(order).where(and(eq(order.id, orderId), eq(order.userId, userId)));
  if (!row) throw notFound('Order');
  return row;
}

export async function getOrder(db: Database, userId: string, orderId: string): Promise<Order> {
  return toOrder(db, await ownedOrder(db, userId, orderId));
}

export async function confirmPayment(deps: OrderDeps, userId: string, orderId: string, result: PaymentResult): Promise<Order> {
  const row = await ownedOrder(deps.db, userId, orderId);
  if (!['draft', 'awaiting_payment', 'expired'].includes(row.status)) return toOrder(deps.db, row);
  const [latest] = await deps.db.select().from(payment).where(eq(payment.orderId, row.id)).orderBy(desc(payment.createdAt)).limit(1);
  if (!latest) throw new HttpError(409, 'no_payment', 'This order has no payment to confirm');
  const valid = deps.payments.verifyClientResult({
    providerOrderId: latest.providerOrderId,
    paymentId: result.payment_id,
    signature: result.signature,
  });
  if (!valid) throw new HttpError(400, 'payment_unverified', 'We couldn’t verify this payment');
  await recordCapture(deps, { providerOrderId: latest.providerOrderId, providerPaymentId: result.payment_id });
  return getOrder(deps.db, userId, orderId);
}

export async function handlePaymentWebhook(deps: OrderDeps, rawBody: string, headers: Headers): Promise<{ duplicate: boolean }> {
  const parsed = deps.payments.parseWebhook(rawBody, headers);
  if (!parsed) throw new HttpError(400, 'invalid_signature', 'Webhook signature is not valid');
  const { db } = deps;
  await db
    .insert(webhookEvent)
    .values({ source: 'razorpay', eventId: parsed.eventId, type: parsed.type, payload: parsed.payload as object })
    .onConflictDoNothing();
  const match = and(eq(webhookEvent.source, 'razorpay'), eq(webhookEvent.eventId, parsed.eventId));
  const [stored] = await db.select().from(webhookEvent).where(match);
  if (stored?.processedAt) return { duplicate: true };
  try {
    const event = parsed.event;
    if (event?.type === 'captured') {
      await recordCapture(deps, event);
    } else if (event?.type === 'failed') {
      await db
        .update(payment)
        .set({ status: 'failed', providerPaymentId: event.providerPaymentId, updatedAt: new Date() })
        .where(and(eq(payment.providerOrderId, event.providerOrderId), eq(payment.status, 'created')));
    } else if (event?.type === 'refunded') {
      await db
        .update(payment)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(payment.providerPaymentId, event.providerPaymentId));
    }
    await db.update(webhookEvent).set({ processedAt: new Date(), error: null }).where(match);
    return { duplicate: false };
  } catch (error) {
    await db.update(webhookEvent).set({ error: error instanceof Error ? error.message : String(error) }).where(match);
    throw error;
  }
}

export async function expireStaleOrders(db: Database): Promise<number> {
  const expired = await db
    .update(order)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        inArray(order.status, ['draft', 'awaiting_payment']),
        lt(order.createdAt, sql`now() - make_interval(mins => ${ORDER_TTL_MINUTES})`),
      ),
    )
    .returning({ id: order.id });
  return expired.length;
}

const TOP_UP_STATUSES: (typeof esim.$inferSelect.status)[] = ['not_started', 'active', 'depleted'];

export async function listTopUpPacks(db: Database, userId: string, iccid: string, currency: CurrencyCode): Promise<TopUpPack[]> {
  const [owned] = await db.select().from(esim).where(and(eq(esim.userId, userId), eq(esim.iccid, iccid)));
  if (!owned) throw notFound('eSIM');
  if (!TOP_UP_STATUSES.includes(owned.status)) return [];
  const [supplied] = await db.select({ provider: plan.provider }).from(plan).where(eq(plan.id, owned.planId));
  if (owned.provider && supplied?.provider && owned.provider !== supplied.provider) return [];
  const rows = await db
    .select({ pack: topUpPack, priceMinor: topUpPrice.amountMinor })
    .from(topUpPack)
    .innerJoin(topUpPrice, and(eq(topUpPrice.packId, topUpPack.id), eq(topUpPrice.currency, currency)))
    .where(and(eq(topUpPack.planId, owned.planId), eq(topUpPack.active, true)))
    .orderBy(topUpPack.dataMb);
  return rows.map((row) => ({
    id: row.pack.id,
    iccid,
    data_mb: row.pack.dataMb,
    extra_days: row.pack.extraDays,
    price: fromMinor(row.priceMinor, currency),
    currency,
  }));
}

export async function createTopUpOrder(
  deps: OrderDeps,
  userId: string,
  input: { iccid: string; packId: string; currency: CurrencyCode },
  idempotencyKey: string,
): Promise<Checkout> {
  const { db } = deps;
  const byKey = and(eq(order.userId, userId), eq(order.idempotencyKey, idempotencyKey));
  const [existing] = await db.select().from(order).where(byKey);
  if (existing) return checkoutFor(deps, existing);
  if (!deps.payments.supports(input.currency)) {
    throw new HttpError(422, 'currency_unsupported', `Payments in ${input.currency} aren’t available yet`);
  }
  const packs = await listTopUpPacks(db, userId, input.iccid, input.currency);
  const pack = packs.find((item) => item.id === input.packId);
  if (!pack) throw new HttpError(422, 'top_up_unavailable', 'This top-up isn’t available for this eSIM');
  const [owned] = await db.select().from(esim).where(and(eq(esim.userId, userId), eq(esim.iccid, input.iccid)));
  if (!owned) throw notFound('eSIM');
  const balance = await creditBalance(db, userId, input.currency);
  const totals = priceBreakdown(pack.price, null, fromMinor(balance, input.currency), taxRateFor(input.currency));
  const [inserted] = await db
    .insert(order)
    .values({
      number: orderNumber(),
      userId,
      kind: 'top_up',
      status: 'awaiting_payment',
      planId: owned.planId,
      topUpPackId: pack.id,
      esimId: owned.id,
      currency: input.currency,
      subtotalMinor: toMinor(totals.subtotal, input.currency),
      creditMinor: toMinor(totals.credit, input.currency),
      taxMinor: toMinor(totals.tax, input.currency),
      totalMinor: toMinor(totals.total, input.currency),
      idempotencyKey,
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted) {
    const [raced] = await db.select().from(order).where(byKey);
    if (!raced) throw new Error('Order insert conflicted but no order was found');
    return checkoutFor(deps, raced);
  }
  deps.logger.info({ orderId: inserted.id, pack: pack.id }, 'top-up order created');
  return collectPayment(deps, inserted);
}
