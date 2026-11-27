import type { Checkout, Coupon, Order, OrderStatus, OrderSummary, TopUpPack } from '@vela/api';
import { fromMinor, type CurrencyCode } from '../lib/money';
import type { CouponRow } from '../models/coupon.model';
import type { OrderRow } from '../models/order.model';
import type { PaymentRow } from '../models/payment.model';
import type { TopUpPackRow } from '../models/plan.model';

export function publicStatus(status: OrderRow['status']): OrderStatus {
  return status === 'draft' ? 'awaiting_payment' : status;
}

export function orderView(row: OrderRow, iccid: string | null): Order {
  const money = (minor: number) => fromMinor(minor, row.currency);
  return {
    order_id: row.id,
    number: row.number,
    kind: row.kind,
    status: publicStatus(row.status),
    plan_id: row.planId ?? '',
    iccid,
    subtotal: money(row.subtotalMinor),
    discount: money(row.discountMinor),
    credit: money(row.creditMinor),
    tax: money(row.taxMinor),
    total: money(row.totalMinor),
    currency: row.currency,
  };
}

export function orderSummaryView(row: OrderRow, iccid: string | null, invoiceNumber: string | null): OrderSummary {
  return { ...orderView(row, iccid), created_at: row.createdAt.toISOString(), invoice_number: invoiceNumber };
}

/** The order plus what the client needs to collect payment (null once nothing is owed). */
export function checkoutView(view: Order, latest: PaymentRow | null, publicKey: string | null): Checkout {
  if (view.status !== 'awaiting_payment' || !latest) return { order: view, payment: null };
  return {
    order: view,
    payment: {
      provider: latest.provider === 'mock' ? 'mock' : 'razorpay',
      key: publicKey,
      provider_order_id: latest.providerOrderId,
      amount_minor: latest.amountMinor,
      currency: latest.currency,
    },
  };
}

export function couponView(row: CouponRow, currency: CurrencyCode): Coupon {
  return row.kind === 'percent'
    ? { code: row.code, discount_pct: row.value, discount_amount: null, currency }
    : { code: row.code, discount_pct: null, discount_amount: fromMinor(row.value, currency), currency };
}

/** A fixed-amount discount that is not a stored coupon (a referral code). */
export function amountCouponView(code: string, amountMinor: number, currency: CurrencyCode): Coupon {
  return { code, discount_pct: null, discount_amount: fromMinor(amountMinor, currency), currency };
}

export function topUpPackView(pack: TopUpPackRow, priceMinor: number, iccid: string, currency: CurrencyCode): TopUpPack {
  return {
    id: pack.id,
    iccid,
    data_mb: pack.dataMb,
    extra_days: pack.extraDays,
    price: fromMinor(priceMinor, currency),
    currency,
  };
}
