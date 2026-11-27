import type { Database } from '../db/client';
import type { Env } from '../env';
import type { EsimProvider } from '../integrations/esims/provider';
import type { PaymentProvider } from '../integrations/payments/provider';
import { HttpError, notFound } from '../lib/errors';
import { toMinor, type CurrencyCode } from '../lib/money';
import type { Logger } from '../logger';
import * as audits from '../models/audit.model';
import * as coupons from '../models/coupon.model';
import * as credits from '../models/credit.model';
import * as esims from '../models/esim.model';
import * as invoices from '../models/invoice.model';
import * as orders from '../models/order.model';
import * as payments from '../models/payment.model';
import * as profiles from '../models/profile.model';
import { adminCouponView, auditView, staffOrderDetail, staffOrderItem } from '../views/admin.view';
import { settleRefund } from './fulfilment.service';
import { invoiceLink, issueInvoice } from './invoices.service';

export type StaffRole = 'support' | 'admin';
export type AdminDeps = { db: Database; env: Env; logger: Logger; payments: PaymentProvider; provider?: EsimProvider; backupProvider?: EsimProvider | null };

export const ORDER_STATUSES = orders.ORDER_STATUSES;

const AUDIT_LIMIT = 100;
const REFUNDABLE: orders.OrderStatusValue[] = ['paid', 'provisioning', 'fulfilled', 'provisioning_failed'];

export async function listOrders(db: Database, filter: orders.StaffOrderFilter) {
  return (await orders.listForStaff(db, filter)).map(staffOrderItem);
}

export async function orderDetail(db: Database, env: Env, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw notFound('Order');
  const row = await orders.findWithProfile(db, orderId);
  if (!row) throw notFound('Order');
  const current = row.order;
  const [paid, linked, issued, credited, history] = await Promise.all([
    payments.paymentsFor(db, orderId),
    current.esimId ? esims.findEsim(db, current.esimId) : null,
    invoices.findInvoiceForOrder(db, orderId),
    invoices.findCreditNoteForOrder(db, orderId),
    audits.auditFor(db, `order:${orderId}`),
  ]);
  return staffOrderDetail({
    order: current,
    customer: row.profile,
    payments: paid,
    esim: linked,
    invoice: issued ? { number: issued.number, url: invoiceLink(env, issued.id).url } : null,
    creditNote: credited ? { number: credited.number, url: invoiceLink(env, credited.id, Date.now(), { kind: 'credit-notes' }).url } : null,
    history,
  });
}

export async function staffRefund(deps: AdminDeps, actorId: string, orderId: string, reason: string) {
  const current = await orders.findOrder(deps.db, orderId);
  if (!current) throw notFound('Order');
  if (!REFUNDABLE.includes(current.status)) throw new HttpError(409, 'not_refundable', `A ${current.status} order can’t be refunded`);
  const outcome = await settleRefund(deps, current, `Refunded by staff: ${reason}`);
  await audits.audit(deps.db, actorId, 'order.refund', `order:${orderId}`, {
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
  await audits.audit(deps.db, actorId, 'invoice.issue', `order:${orderId}`, { number: issued.number });
  return orderDetail(deps.db, deps.env, orderId);
}

export async function listCoupons(db: Database) {
  const [rows, usage] = await Promise.all([coupons.allCoupons(db), coupons.redemptionCounts(db)]);
  return rows.map((row) => adminCouponView(row, usage.get(row.code) ?? 0));
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
  if (await profiles.findByReferralCode(db, code)) throw new HttpError(409, 'code_taken', 'That code is someone’s referral code');
  const created = await coupons.insertCoupon(db, {
    code,
    kind: input.kind,
    value: input.kind === 'amount' && input.currency ? toMinor(input.value, input.currency) : Math.round(input.value),
    currency: input.kind === 'amount' ? input.currency : null,
    maxRedemptions: input.max_redemptions,
    perUserLimit: input.per_user_limit,
    countryCodes: input.country_codes.map((item) => item.toUpperCase()),
    startsAt: input.starts_at ? new Date(input.starts_at) : null,
    endsAt: input.ends_at ? new Date(input.ends_at) : null,
  });
  if (!created) throw new HttpError(409, 'code_taken', 'A coupon with that code already exists');
  await audits.audit(db, actorId, 'coupon.create', `coupon:${code}`, { ...input, code });
  return adminCouponView(created, 0);
}

export async function updateCoupon(
  db: Database,
  actorId: string,
  code: string,
  input: { ends_at?: string | null; max_redemptions?: number | null; per_user_limit?: number },
) {
  const set: Partial<coupons.NewCoupon> = {};
  if (input.ends_at !== undefined) set.endsAt = input.ends_at ? new Date(input.ends_at) : null;
  if (input.max_redemptions !== undefined) set.maxRedemptions = input.max_redemptions;
  if (input.per_user_limit !== undefined) set.perUserLimit = input.per_user_limit;
  const updated = await coupons.updateCoupon(db, code.toUpperCase(), set);
  if (!updated) throw notFound('Coupon');
  await audits.audit(db, actorId, 'coupon.update', `coupon:${updated.code}`, input);
  return adminCouponView(updated, await coupons.countRedemptions(db, updated.code));
}

export async function grantCredit(db: Database, actorId: string, userId: string, input: { amount: number; currency: CurrencyCode; reason: string }) {
  if (!(await profiles.findProfile(db, userId))) throw notFound('Customer');
  if (input.amount === 0) throw new HttpError(422, 'invalid_amount', 'Amount can’t be zero');
  await credits.addCreditEntry(db, { userId, amountMinor: toMinor(input.amount, input.currency), currency: input.currency, reason: `staff: ${input.reason}` });
  await audits.audit(db, actorId, 'credit.grant', `user:${userId}`, input);
}

export async function recentAudit(db: Database, target: string | undefined) {
  return (await audits.auditFor(db, target, AUDIT_LIMIT)).map(auditView);
}

export async function roleOf(db: Database, userId: string): Promise<'customer' | StaffRole> {
  return (await profiles.roleOf(db, userId)) ?? 'customer';
}
