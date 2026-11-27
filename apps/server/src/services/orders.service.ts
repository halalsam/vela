import { randomInt } from 'node:crypto';
import { priceBreakdown, taxRateFor, type Checkout, type Coupon, type Order, type OrderSummary, type PaymentResult, type TopUpPack } from '@vela/api';
import type { Database } from '../db/client';
import type { Env } from '../env';
import type { PaymentProvider } from '../integrations/payments/provider';
import { JOB, type JobQueue } from '../jobs/queue';
import { HttpError, notFound } from '../lib/errors';
import { fromMinor, toMinor, type CurrencyCode } from '../lib/money';
import type { Logger } from '../logger';
import * as coupons from '../models/coupon.model';
import * as credits from '../models/credit.model';
import * as esims from '../models/esim.model';
import * as orders from '../models/order.model';
import * as payments from '../models/payment.model';
import * as plans from '../models/plan.model';
import * as profiles from '../models/profile.model';
import { checkoutView, couponView, orderSummaryView, orderView, topUpPackView } from '../views/order.view';
import { planById } from './catalog.service';
import { creditBalance, findReferrer, referralCoupon } from './rewards.service';

export type OrderDeps = { db: Database; env: Env; payments: PaymentProvider; queue: JobQueue; logger: Logger };

type OrderRow = orders.OrderRow;
type CouponRow = coupons.CouponRow;

const NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ORDER_TTL_MINUTES = 30;
const ORDER_HISTORY_LIMIT = 100;
const TOP_UP_STATUSES: esims.EsimStatusValue[] = ['not_started', 'active', 'depleted'];

function orderNumber(): string {
  return `VL-${Array.from({ length: 8 }, () => NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)]).join('')}`;
}

async function toOrder(db: Database, row: OrderRow): Promise<Order> {
  return orderView(row, row.esimId ? await esims.iccidOf(db, row.esimId) : null);
}

const couponInvalid = () => new HttpError(422, 'coupon_invalid', 'That code can’t be used on this plan');
const currencyUnsupported = (currency: CurrencyCode) => new HttpError(422, 'currency_unsupported', `Payments in ${currency} aren’t available yet`);

/** A coupon the user may apply right now, or a 422. */
export async function findCoupon(
  db: Database,
  code: string,
  context: { currency: CurrencyCode; countryCodes?: string[]; userId?: string },
): Promise<CouponRow> {
  const row = await coupons.findCoupon(db, code.trim().toUpperCase());
  if (!row) throw couponInvalid();
  const now = Date.now();
  if ((row.startsAt && row.startsAt.getTime() > now) || (row.endsAt && row.endsAt.getTime() < now)) throw couponInvalid();
  if (row.kind === 'amount' && row.currency !== context.currency) throw couponInvalid();
  if (context.countryCodes && row.countryCodes.length > 0 && !context.countryCodes.some((item) => row.countryCodes.includes(item))) {
    throw couponInvalid();
  }
  if (row.maxRedemptions !== null && (await coupons.countRedemptions(db, row.code)) >= row.maxRedemptions) throw couponInvalid();
  if (context.userId && (await coupons.countRedemptions(db, row.code, context.userId)) >= row.perUserLimit) throw couponInvalid();
  return row;
}

type Discount = { view: Coupon; couponCode: string | null; referralCode: string | null };

/** A stored coupon first, then a friend's referral code. */
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
  const latest = view.status === 'awaiting_payment' ? await payments.latestPaymentFor(deps.db, row.id) : null;
  return checkoutView(view, latest, deps.payments.publicKey);
}

/** Inserts a priced order once per idempotency key; a retry or a race returns the stored one. */
async function placeOrder(deps: OrderDeps, values: orders.NewOrder): Promise<{ row: OrderRow; created: boolean }> {
  const inserted = await orders.insertOrder(deps.db, values);
  if (inserted) return { row: inserted, created: true };
  const raced = await orders.findByIdempotencyKey(deps.db, values.userId, values.idempotencyKey);
  if (!raced) throw new Error('Order insert conflicted but no order was found');
  return { row: raced, created: false };
}

function totalsInMinor(totals: ReturnType<typeof priceBreakdown>, currency: CurrencyCode) {
  return {
    subtotalMinor: toMinor(totals.subtotal, currency),
    discountMinor: toMinor(totals.discount, currency),
    creditMinor: toMinor(totals.credit, currency),
    taxMinor: toMinor(totals.tax, currency),
    totalMinor: toMinor(totals.total, currency),
  };
}

export async function createOrder(
  deps: OrderDeps,
  userId: string,
  input: { planId: string; couponCode: string | null; currency: CurrencyCode },
  idempotencyKey: string,
): Promise<Checkout> {
  const { db } = deps;
  const existing = await orders.findByIdempotencyKey(db, userId, idempotencyKey);
  if (existing) return checkoutFor(deps, existing);

  if (!deps.payments.supports(input.currency)) throw currencyUnsupported(input.currency);
  const plan = await planById(db, input.planId, input.currency);
  if (!plan) throw notFound('Plan');
  const applied = input.couponCode
    ? await resolveDiscount(db, input.couponCode, { currency: input.currency, countryCodes: plan.country_codes, userId })
    : null;
  const balance = await creditBalance(db, userId, input.currency);
  const totals = priceBreakdown(plan.price, applied?.view ?? null, fromMinor(balance, input.currency), taxRateFor(input.currency));

  const placed = await placeOrder(deps, {
    number: orderNumber(),
    userId,
    kind: 'esim',
    status: 'awaiting_payment',
    planId: plan.id,
    currency: input.currency,
    ...totalsInMinor(totals, input.currency),
    couponCode: applied?.couponCode ?? null,
    referralCode: applied?.referralCode ?? null,
    idempotencyKey,
  });
  return placed.created ? collectPayment(deps, placed.row) : checkoutFor(deps, placed.row);
}

async function collectPayment(deps: OrderDeps, inserted: OrderRow): Promise<Checkout> {
  const { db } = deps;
  if (inserted.totalMinor === 0) {
    await markPaid(deps, inserted.id);
    return checkoutFor(deps, (await orders.findOrder(db, inserted.id)) ?? inserted);
  }

  const created = await deps.payments.createPayment({
    receipt: inserted.number,
    amountMinor: inserted.totalMinor,
    currency: inserted.currency,
    orderId: inserted.id,
  });
  await payments.insertPayment(db, {
    orderId: inserted.id,
    provider: deps.payments.name,
    providerOrderId: created.providerOrderId,
    amountMinor: inserted.totalMinor,
    currency: inserted.currency,
  });
  deps.logger.info({ orderId: inserted.id, number: inserted.number, total: inserted.totalMinor }, 'order created');
  return checkoutFor(deps, inserted);
}

/** Marks the order paid exactly once, books its coupon, credit and referral, and queues provisioning. */
async function markPaid(deps: OrderDeps, orderId: string): Promise<boolean> {
  const transitioned = await deps.db.transaction(async (tx) => {
    const paid = await orders.transitionOrder(tx, orderId, orders.UNPAID_STATUSES, 'paid', { paidAt: new Date() });
    if (!paid) return false;
    if (paid.couponCode) await coupons.recordRedemption(tx, { couponCode: paid.couponCode, userId: paid.userId, orderId: paid.id });
    if (paid.creditMinor > 0) {
      await credits.addCreditEntry(tx, { userId: paid.userId, amountMinor: -paid.creditMinor, currency: paid.currency, reason: 'order', orderId: paid.id });
    }
    if (paid.referralCode) {
      const referrer = await profiles.findByReferralCode(tx, paid.referralCode);
      if (referrer && referrer.userId !== paid.userId) await profiles.setReferrerIfEmpty(tx, paid.userId, referrer.userId);
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
  const row = await payments.findByProviderOrder(deps.db, deps.payments.name, input.providerOrderId);
  if (!row) {
    deps.logger.warn({ providerOrderId: input.providerOrderId }, 'capture for an unknown payment');
    return false;
  }
  if (input.amountMinor !== undefined && input.amountMinor !== row.amountMinor) {
    deps.logger.error({ orderId: row.orderId, expected: row.amountMinor, got: input.amountMinor }, 'captured amount does not match the order');
    return false;
  }
  if (row.status !== 'captured' && row.status !== 'refunded') {
    await payments.updatePayment(deps.db, row.id, { status: 'captured', providerPaymentId: input.providerPaymentId, raw: input.raw ?? null });
  }
  return markPaid(deps, row.orderId);
}

async function ownedOrder(db: Database, userId: string, orderId: string): Promise<OrderRow> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw notFound('Order');
  const row = await orders.findUserOrder(db, userId, orderId);
  if (!row) throw notFound('Order');
  return row;
}

export async function listOrdersFor(db: Database, userId: string): Promise<OrderSummary[]> {
  const rows = await orders.listSettledWithInvoice(db, userId, ORDER_HISTORY_LIMIT);
  return Promise.all(
    rows.map(async (row) => orderSummaryView(row.order, row.order.esimId ? await esims.iccidOf(db, row.order.esimId) : null, row.invoiceNumber)),
  );
}

export async function getOrder(db: Database, userId: string, orderId: string): Promise<Order> {
  return toOrder(db, await ownedOrder(db, userId, orderId));
}

/** The client's checkout result: verify the signature, then treat it as a capture. */
export async function confirmPayment(deps: OrderDeps, userId: string, orderId: string, result: PaymentResult): Promise<Order> {
  const row = await ownedOrder(deps.db, userId, orderId);
  if (!orders.UNPAID_STATUSES.includes(row.status)) return toOrder(deps.db, row);
  const latest = await payments.latestPaymentFor(deps.db, row.id);
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
  const stored = await payments.recordWebhookEvent(db, {
    source: 'razorpay',
    eventId: parsed.eventId,
    type: parsed.type,
    payload: parsed.payload as object,
  });
  if (stored?.processedAt) return { duplicate: true };
  try {
    const event = parsed.event;
    if (event?.type === 'captured') await recordCapture(deps, event);
    else if (event?.type === 'failed') await payments.markFailedByProviderOrder(db, event.providerOrderId, event.providerPaymentId);
    else if (event?.type === 'refunded') await payments.markRefundedByProviderPayment(db, event.providerPaymentId);
    await payments.finishWebhookEvent(db, 'razorpay', parsed.eventId, null);
    return { duplicate: false };
  } catch (error) {
    await payments.finishWebhookEvent(db, 'razorpay', parsed.eventId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function expireStaleOrders(db: Database): Promise<number> {
  return orders.expireOlderThan(db, ORDER_TTL_MINUTES);
}

export async function listTopUpPacks(db: Database, userId: string, iccid: string, currency: CurrencyCode): Promise<TopUpPack[]> {
  const owned = await esims.findUserEsim(db, userId, iccid);
  if (!owned) throw notFound('eSIM');
  if (!TOP_UP_STATUSES.includes(owned.status)) return [];
  // Top-ups only work with the supplier that issued the eSIM.
  const supplied = await plans.findPlanRow(db, owned.planId);
  if (owned.provider && supplied?.provider && owned.provider !== supplied.provider) return [];
  const rows = await plans.activeTopUpsWithPrice(db, owned.planId, currency);
  return rows.map((row) => topUpPackView(row.pack, row.priceMinor, iccid, currency));
}

export async function createTopUpOrder(
  deps: OrderDeps,
  userId: string,
  input: { iccid: string; packId: string; currency: CurrencyCode },
  idempotencyKey: string,
): Promise<Checkout> {
  const { db } = deps;
  const existing = await orders.findByIdempotencyKey(db, userId, idempotencyKey);
  if (existing) return checkoutFor(deps, existing);
  if (!deps.payments.supports(input.currency)) throw currencyUnsupported(input.currency);
  const packs = await listTopUpPacks(db, userId, input.iccid, input.currency);
  const pack = packs.find((item) => item.id === input.packId);
  if (!pack) throw new HttpError(422, 'top_up_unavailable', 'This top-up isn’t available for this eSIM');
  const owned = await esims.findUserEsim(db, userId, input.iccid);
  if (!owned) throw notFound('eSIM');
  const balance = await creditBalance(db, userId, input.currency);
  const totals = priceBreakdown(pack.price, null, fromMinor(balance, input.currency), taxRateFor(input.currency));
  const placed = await placeOrder(deps, {
    number: orderNumber(),
    userId,
    kind: 'top_up',
    status: 'awaiting_payment',
    planId: owned.planId,
    topUpPackId: pack.id,
    esimId: owned.id,
    currency: input.currency,
    ...totalsInMinor(totals, input.currency),
    idempotencyKey,
  });
  if (!placed.created) return checkoutFor(deps, placed.row);
  deps.logger.info({ orderId: placed.row.id, pack: pack.id }, 'top-up order created');
  return collectPayment(deps, placed.row);
}
