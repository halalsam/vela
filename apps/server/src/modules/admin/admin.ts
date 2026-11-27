import { and, count, desc, eq, ilike, lt, or, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { auditLog, coupon, couponRedemption, creditLedger, creditNote, esim, invoice, order, payment, profile } from '../../db/schema';
import type { Env } from '../../env';
import { HttpError, notFound } from '../../lib/errors';
import { fromMinor, toMinor, type CurrencyCode } from '../../lib/money';
import type { Logger } from '../../logger';
import { invoiceLink, issueInvoice } from '../invoices/invoice';
import { settleRefund } from '../orders/fulfil';
import type { EsimProvider } from '../esims/provider';
import type { PaymentProvider } from '../payments/provider';

export type StaffRole = 'support' | 'admin';
export type AdminDeps = { db: Database; env: Env; logger: Logger; payments: PaymentProvider; provider?: EsimProvider; backupProvider?: EsimProvider | null };
type OrderStatus = (typeof order.$inferSelect)['status'];

export async function audit(db: Database, actorId: string, action: string, target: string, data: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({ actorId, action, target, data });
}

export async function listOrders(db: Database, filter: { status?: OrderStatus; q?: string; before?: Date; userId?: string; limit: number }) {
  const where: SQL[] = [];
  if (filter.userId) where.push(eq(order.userId, filter.userId));
  if (filter.status) where.push(eq(order.status, filter.status));
  if (filter.before) where.push(lt(order.createdAt, filter.before));
  if (filter.q) {
    const term = `%${filter.q.trim()}%`;
    const match = or(ilike(order.number, term), ilike(profile.phone, term), ilike(profile.email, term), ilike(esim.iccid, term));
    if (match) where.push(match);
  }
  const rows = await db
    .select({ order, name: profile.name, phone: profile.phone, email: profile.email, iccid: esim.iccid, invoice: invoice.number })
    .from(order)
    .leftJoin(profile, eq(profile.userId, order.userId))
    .leftJoin(esim, eq(esim.id, order.esimId))
    .leftJoin(invoice, eq(invoice.orderId, order.id))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(order.createdAt))
    .limit(filter.limit);
  return rows.map((row) => ({
    order_id: row.order.id,
    number: row.order.number,
    kind: row.order.kind,
    status: row.order.status,
    plan_id: row.order.planId,
    iccid: row.iccid,
    total: fromMinor(row.order.totalMinor, row.order.currency),
    currency: row.order.currency,
    created_at: row.order.createdAt.toISOString(),
    customer: { user_id: row.order.userId, name: row.name, phone: row.phone, email: row.email },
    invoice_number: row.invoice,
  }));
}

export async function orderDetail(db: Database, env: Env, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw notFound('Order');
  const [row] = await db
    .select({ order, profile })
    .from(order)
    .leftJoin(profile, eq(profile.userId, order.userId))
    .where(eq(order.id, orderId));
  if (!row) throw notFound('Order');
  const current = row.order;
  const payments = await db.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(desc(payment.createdAt));
  const [linked] = current.esimId ? await db.select().from(esim).where(eq(esim.id, current.esimId)) : [];
  const [issued] = await db.select().from(invoice).where(eq(invoice.orderId, orderId));
  const [credited] = await db.select().from(creditNote).where(eq(creditNote.orderId, orderId));
  const history = await db.select().from(auditLog).where(eq(auditLog.target, `order:${orderId}`)).orderBy(desc(auditLog.createdAt));
  const money = (minor: number) => fromMinor(minor, current.currency);
  return {
    order_id: current.id,
    number: current.number,
    kind: current.kind,
    status: current.status,
    plan_id: current.planId,
    top_up_pack_id: current.topUpPackId,
    currency: current.currency,
    subtotal: money(current.subtotalMinor),
    discount: money(current.discountMinor),
    credit: money(current.creditMinor),
    tax: money(current.taxMinor),
    total: money(current.totalMinor),
    coupon_code: current.couponCode,
    referral_code: current.referralCode,
    failure_reason: current.failureReason,
    created_at: current.createdAt.toISOString(),
    paid_at: current.paidAt?.toISOString() ?? null,
    fulfilled_at: current.fulfilledAt?.toISOString() ?? null,
    customer: {
      user_id: current.userId,
      name: row.profile?.name ?? null,
      phone: row.profile?.phone ?? null,
      email: row.profile?.email ?? null,
    },
    payments: payments.map((item) => ({
      provider: item.provider,
      provider_order_id: item.providerOrderId,
      provider_payment_id: item.providerPaymentId,
      status: item.status,
      amount: fromMinor(item.amountMinor, item.currency),
    })),
    esim: linked
      ? {
          iccid: linked.iccid,
          status: linked.status,
          data_used_mb: linked.dataUsedMb,
          data_total_mb: linked.dataTotalMb,
          expires_at: linked.expiresAt?.toISOString() ?? null,
        }
      : null,
    invoice: issued ? { number: issued.number, url: invoiceLink(env, issued.id).url } : null,
    credit_note: credited ? { number: credited.number, url: invoiceLink(env, credited.id, Date.now(), { kind: 'credit-notes' }).url } : null,
    history: history.map((item) => ({ action: item.action, actor_id: item.actorId, data: item.data, at: item.createdAt.toISOString() })),
  };
}

const REFUNDABLE: OrderStatus[] = ['paid', 'provisioning', 'fulfilled', 'provisioning_failed'];

export async function staffRefund(deps: AdminDeps, actorId: string, orderId: string, reason: string) {
  const [current] = await deps.db.select().from(order).where(eq(order.id, orderId));
  if (!current) throw notFound('Order');
  if (!REFUNDABLE.includes(current.status)) throw new HttpError(409, 'not_refundable', `A ${current.status} order can’t be refunded`);
  const outcome = await settleRefund(deps, current, `Refunded by staff: ${reason}`);
  await audit(deps.db, actorId, 'order.refund', `order:${orderId}`, {
    reason,
    previous: current.status,
    supplierCancelled: outcome.supplierCancelled,
    creditNote: outcome.creditNote,
  });
  deps.logger.info({ orderId, actorId }, 'order refunded by staff');
  return orderDetail(deps.db, deps.env, orderId);
}

export async function staffIssueInvoice(deps: AdminDeps, actorId: string, orderId: string) {
  const issued = await issueInvoice(deps.db, deps.env, deps.logger, orderId);
  if (!issued) throw new HttpError(409, 'no_invoice', 'Invoices are issued only for fulfilled INR orders');
  await audit(deps.db, actorId, 'invoice.issue', `order:${orderId}`, { number: issued.number });
  return orderDetail(deps.db, deps.env, orderId);
}

export async function listCoupons(db: Database) {
  const rows = await db.select().from(coupon).orderBy(desc(coupon.createdAt));
  const used = await db.select({ code: couponRedemption.couponCode, value: count() }).from(couponRedemption).groupBy(couponRedemption.couponCode);
  const usage = new Map(used.map((item) => [item.code, item.value]));
  return rows.map(couponOut(usage));
}

function couponOut(usage: Map<string, number>) {
  return (row: typeof coupon.$inferSelect) => ({
    code: row.code,
    kind: row.kind,
    value: row.kind === 'amount' && row.currency ? fromMinor(row.value, row.currency) : row.value,
    currency: row.currency,
    max_redemptions: row.maxRedemptions,
    per_user_limit: row.perUserLimit,
    country_codes: row.countryCodes,
    starts_at: row.startsAt?.toISOString() ?? null,
    ends_at: row.endsAt?.toISOString() ?? null,
    redemptions: usage.get(row.code) ?? 0,
  });
}

export type CouponInput = {
  code: string;
  kind: 'percent' | 'amount';
  value: number;
  currency: CurrencyCode | null;
  max_redemptions: number | null;
  per_user_limit: number;
  country_codes: string[];
  starts_at: string | null;
  ends_at: string | null;
};

export async function createCoupon(db: Database, actorId: string, input: CouponInput) {
  const code = input.code.trim().toUpperCase();
  if (input.kind === 'percent' && (input.value <= 0 || input.value > 100)) throw new HttpError(422, 'invalid_coupon', 'A percentage must be 1 to 100');
  if (input.kind === 'amount' && !input.currency) throw new HttpError(422, 'invalid_coupon', 'An amount coupon needs a currency');
  const [taken] = await db.select({ code: profile.referralCode }).from(profile).where(eq(profile.referralCode, code));
  if (taken) throw new HttpError(409, 'code_taken', 'That code is someone’s referral code');
  const [created] = await db
    .insert(coupon)
    .values({
      code,
      kind: input.kind,
      value: input.kind === 'amount' && input.currency ? toMinor(input.value, input.currency) : Math.round(input.value),
      currency: input.kind === 'amount' ? input.currency : null,
      maxRedemptions: input.max_redemptions,
      perUserLimit: input.per_user_limit,
      countryCodes: input.country_codes.map((item) => item.toUpperCase()),
      startsAt: input.starts_at ? new Date(input.starts_at) : null,
      endsAt: input.ends_at ? new Date(input.ends_at) : null,
    })
    .onConflictDoNothing()
    .returning();
  if (!created) throw new HttpError(409, 'code_taken', 'A coupon with that code already exists');
  await audit(db, actorId, 'coupon.create', `coupon:${code}`, { ...input, code });
  return couponOut(new Map())(created);
}

export async function updateCoupon(
  db: Database,
  actorId: string,
  code: string,
  input: { ends_at?: string | null; max_redemptions?: number | null; per_user_limit?: number },
) {
  const set: Partial<typeof coupon.$inferInsert> = { updatedAt: new Date() };
  if (input.ends_at !== undefined) set.endsAt = input.ends_at ? new Date(input.ends_at) : null;
  if (input.max_redemptions !== undefined) set.maxRedemptions = input.max_redemptions;
  if (input.per_user_limit !== undefined) set.perUserLimit = input.per_user_limit;
  const [updated] = await db.update(coupon).set(set).where(eq(coupon.code, code.toUpperCase())).returning();
  if (!updated) throw notFound('Coupon');
  await audit(db, actorId, 'coupon.update', `coupon:${updated.code}`, input);
  const [used] = await db.select({ value: count() }).from(couponRedemption).where(eq(couponRedemption.couponCode, updated.code));
  return couponOut(new Map([[updated.code, used?.value ?? 0]]))(updated);
}

export async function grantCredit(
  db: Database,
  actorId: string,
  userId: string,
  input: { amount: number; currency: CurrencyCode; reason: string },
) {
  const [target] = await db.select({ userId: profile.userId }).from(profile).where(eq(profile.userId, userId));
  if (!target) throw notFound('Customer');
  if (input.amount === 0) throw new HttpError(422, 'invalid_amount', 'Amount can’t be zero');
  await db.insert(creditLedger).values({ userId, amountMinor: toMinor(input.amount, input.currency), currency: input.currency, reason: `staff: ${input.reason}` });
  await audit(db, actorId, 'credit.grant', `user:${userId}`, input);
}

export async function recentAudit(db: Database, target: string | undefined) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(target ? eq(auditLog.target, target) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
  return rows.map((item) => ({ action: item.action, actor_id: item.actorId, target: item.target, data: item.data, at: item.createdAt.toISOString() }));
}

export async function roleOf(db: Database, userId: string): Promise<'customer' | StaffRole> {
  const [row] = await db.select({ role: profile.role }).from(profile).where(eq(profile.userId, userId));
  return row?.role ?? 'customer';
}

export const ORDER_STATUSES = order.status.enumValues;
