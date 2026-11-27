import { fromMinor } from '../lib/money';
import type { AuditRow } from '../models/audit.model';
import type { CouponRow } from '../models/coupon.model';
import type { EsimRow } from '../models/esim.model';
import type { OrderRow } from '../models/order.model';
import type { PaymentRow } from '../models/payment.model';
import type { ProfileRow } from '../models/profile.model';

type Customer = Pick<ProfileRow, 'name' | 'phone' | 'email'>;
type DocumentLink = { number: string; url: string };

export function staffOrderItem(row: { order: OrderRow; name: string | null; phone: string | null; email: string | null; iccid: string | null; invoice: string | null }) {
  return {
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
  };
}

export type StaffOrderItem = ReturnType<typeof staffOrderItem>;

export function historyView(item: AuditRow) {
  return { action: item.action, actor_id: item.actorId, data: item.data, at: item.createdAt.toISOString() };
}

export function auditView(item: AuditRow) {
  return { action: item.action, actor_id: item.actorId, target: item.target, data: item.data, at: item.createdAt.toISOString() };
}

export function staffOrderDetail(input: {
  order: OrderRow;
  customer: Customer | null;
  payments: PaymentRow[];
  esim: EsimRow | null;
  invoice: DocumentLink | null;
  creditNote: DocumentLink | null;
  history: AuditRow[];
}) {
  const current = input.order;
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
      name: input.customer?.name ?? null,
      phone: input.customer?.phone ?? null,
      email: input.customer?.email ?? null,
    },
    payments: input.payments.map((item) => ({
      provider: item.provider,
      provider_order_id: item.providerOrderId,
      provider_payment_id: item.providerPaymentId,
      status: item.status,
      amount: fromMinor(item.amountMinor, item.currency),
    })),
    esim: input.esim
      ? {
          iccid: input.esim.iccid,
          status: input.esim.status,
          data_used_mb: input.esim.dataUsedMb,
          data_total_mb: input.esim.dataTotalMb,
          expires_at: input.esim.expiresAt?.toISOString() ?? null,
        }
      : null,
    invoice: input.invoice,
    credit_note: input.creditNote,
    history: input.history.map(historyView),
  };
}

export function adminCouponView(row: CouponRow, redemptions: number) {
  return {
    code: row.code,
    kind: row.kind,
    value: row.kind === 'amount' && row.currency ? fromMinor(row.value, row.currency) : row.value,
    currency: row.currency,
    max_redemptions: row.maxRedemptions,
    per_user_limit: row.perUserLimit,
    country_codes: row.countryCodes,
    starts_at: row.startsAt?.toISOString() ?? null,
    ends_at: row.endsAt?.toISOString() ?? null,
    redemptions,
  };
}
