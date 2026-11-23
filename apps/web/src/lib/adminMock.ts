'use client';

import type { AdminCoupon, AdminOrder, AdminOrderRow } from './adminApi';

const HOUR = 3_600_000;
const STATUSES = ['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled', 'awaiting_payment', 'refunded', 'provisioning_failed', 'expired', 'paid'] as const;
const PEOPLE = [
  { name: 'Aisha Rahman', phone: '+971501234567', email: 'aisha@example.com' },
  { name: 'Rohan Mehta', phone: '+919876543210', email: null },
  { name: 'Omar Al-Sabah', phone: '+96550123456', email: 'omar@example.com' },
  { name: 'Priya Nair', phone: '+919812345678', email: 'priya@example.com' },
  { name: 'Lukas Weber', phone: '+491512345678', email: 'lukas@example.com' },
  { name: null, phone: '+966501234567', email: null },
  { name: 'Sara Haddad', phone: '+97455512345', email: 'sara@example.com' },
  { name: 'Emily Clark', phone: '+14155550123', email: 'emily@example.com' },
];
const PLANS = [
  { id: 'jp-10gb-15d', prices: { INR: 1199, AED: 41.99, EUR: 10.99, USD: 11.99 } },
  { id: 'th-3gb-7d', prices: { INR: 399, AED: 14.99, EUR: 3.99, USD: 4.99 } },
  { id: 'ae-5gb-30d', prices: { INR: 699, AED: 24.99, EUR: 6.99, USD: 7.99 } },
  { id: 'europe-10gb-30d', prices: { INR: 1499, AED: 52.99, EUR: 13.99, USD: 14.99 } },
  { id: 'asia-5gb-15d', prices: { INR: 899, AED: 31.99, EUR: 8.99, USD: 9.99 } },
];
const CURRENCIES = ['INR', 'INR', 'INR', 'AED', 'EUR', 'USD'] as const;

function pad(value: number, size: number) {
  return String(value).padStart(size, '0');
}

function buildOrders(): AdminOrder[] {
  const now = Date.now();
  return Array.from({ length: 28 }, (_, index) => {
    const person = PEOPLE[index % PEOPLE.length] ?? PEOPLE[0]!;
    const plan = PLANS[(index * 3) % PLANS.length] ?? PLANS[0]!;
    const currency = CURRENCIES[index % CURRENCIES.length] ?? 'INR';
    const status = STATUSES[index % STATUSES.length] ?? 'fulfilled';
    const kind = index % 7 === 3 ? ('top_up' as const) : ('esim' as const);
    const subtotal = kind === 'top_up' ? (currency === 'INR' ? 199 : 2.99) : plan.prices[currency];
    const discount = index % 5 === 0 ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
    const credit = index % 9 === 4 ? Math.min(150, subtotal - discount) : 0;
    const total = Math.round((subtotal - discount - credit) * 100) / 100;
    const tax = currency === 'INR' ? Math.round(total - total / 1.18) : 0;
    const created = new Date(now - index * 7 * HOUR - (index % 3) * 1_200_000);
    const paid = status === 'awaiting_payment' || status === 'expired' ? null : new Date(created.getTime() + 90_000);
    const fulfilled = status === 'fulfilled' || status === 'refunded' ? new Date(created.getTime() + 140_000) : null;
    const iccid = `8999${pad(41_000_000_000 + index * 7_919, 15)}`;
    const id = `00000000-0000-4000-8000-${pad(index + 1, 12)}`;
    return {
      order_id: id,
      number: `VL-${['K7Q2', 'M9XA', 'P4TR', 'W2HN', 'B8CJ', 'D3LF'][index % 6]}${pad(index + 11, 4)}`,
      kind,
      status,
      plan_id: plan.id,
      top_up_pack_id: kind === 'top_up' ? `${plan.id}-topup-1gb` : null,
      currency,
      subtotal,
      discount,
      credit,
      tax,
      total,
      coupon_code: discount > 0 ? 'GULF20' : null,
      referral_code: null,
      failure_reason:
        status === 'provisioning_failed'
          ? 'eSIM Access 200011: Insufficient available Profiles for the package'
          : status === 'refunded'
            ? 'Refunded by staff: customer could not install'
            : null,
      created_at: created.toISOString(),
      paid_at: paid?.toISOString() ?? null,
      fulfilled_at: fulfilled?.toISOString() ?? null,
      customer: { user_id: `user_${pad(index % PEOPLE.length, 4)}`, ...person },
      payments:
        total > 0 && paid
          ? [
              {
                provider: 'razorpay',
                provider_order_id: `order_Pq${pad(index * 3_121, 10)}`,
                provider_payment_id: `pay_Pq${pad(index * 7_717, 10)}`,
                status: status === 'refunded' ? 'refunded' : 'captured',
                amount: total,
              },
            ]
          : [],
      esim:
        fulfilled !== null
          ? {
              iccid,
              status: index % 4 === 0 ? 'active' : index % 4 === 1 ? 'not_started' : index % 4 === 2 ? 'active' : 'expired',
              data_used_mb: index % 4 === 1 ? 0 : 400 + index * 173,
              data_total_mb: 10_240,
              expires_at: new Date(created.getTime() + 15 * 24 * HOUR).toISOString(),
            }
          : null,
      invoice: fulfilled !== null && currency === 'INR' ? { number: `VL/2026-27/${pad(1000 + index, 6)}`, url: '#demo-invoice' } : null,
      history:
        status === 'refunded'
          ? [{ action: 'order.refund', actor_id: 'staff_demo', data: { reason: 'customer could not install' }, at: new Date(created.getTime() + 6 * HOUR).toISOString() }]
          : [],
    };
  });
}

const orders = buildOrders();
const coupons: AdminCoupon[] = [
  { code: 'GULF20', kind: 'percent', value: 20, currency: null, max_redemptions: null, per_user_limit: 1, country_codes: [], starts_at: null, ends_at: null, redemptions: 41 },
  { code: 'FIRSTSAIL', kind: 'amount', value: 150, currency: 'INR', max_redemptions: 500, per_user_limit: 1, country_codes: [], starts_at: null, ends_at: null, redemptions: 212 },
  {
    code: 'TOKYO15',
    kind: 'percent',
    value: 15,
    currency: null,
    max_redemptions: 100,
    per_user_limit: 1,
    country_codes: ['JP'],
    starts_at: null,
    ends_at: new Date(Date.now() + 9 * 24 * HOUR).toISOString(),
    redemptions: 37,
  },
  {
    code: 'MONSOON100',
    kind: 'amount',
    value: 100,
    currency: 'INR',
    max_redemptions: 50,
    per_user_limit: 1,
    country_codes: [],
    starts_at: null,
    ends_at: new Date(Date.now() - 3 * 24 * HOUR).toISOString(),
    redemptions: 50,
  },
];

function toRow(order: AdminOrder): AdminOrderRow {
  return {
    order_id: order.order_id,
    number: order.number,
    kind: order.kind,
    status: order.status,
    plan_id: order.plan_id,
    iccid: order.esim?.iccid ?? null,
    total: order.total,
    currency: order.currency,
    created_at: order.created_at,
    customer: { name: order.customer.name, phone: order.customer.phone, email: order.customer.email },
    invoice_number: order.invoice?.number ?? null,
  };
}

class DemoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function find(id: string): AdminOrder {
  const order = orders.find((item) => item.order_id === id);
  if (!order) throw new DemoError(404, 'Order not found');
  return order;
}

export async function demoAdmin(path: string, init: { method?: string; body?: unknown }): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  const url = new URL(path, 'https://demo.invalid');
  const method = init.method ?? 'GET';
  const parts = url.pathname.split('/').filter(Boolean);
  const body = (init.body ?? {}) as Record<string, unknown>;

  if (url.pathname === '/v1/admin/me') return { user_id: 'staff_demo', role: 'admin' };
  if (url.pathname === '/v1/admin/orders' && method === 'GET') {
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q')?.toLowerCase();
    return orders
      .filter((order) => !status || order.status === status)
      .filter(
        (order) =>
          !q ||
          [order.number, order.customer.phone, order.customer.email, order.esim?.iccid].some((value) => value?.toLowerCase().includes(q)),
      )
      .map(toRow);
  }
  if (parts[2] === 'orders' && parts[3]) {
    const order = find(parts[3]);
    if (method === 'GET') return order;
    if (parts[4] === 'refund') {
      order.status = 'refunded';
      order.failure_reason = `Refunded by staff: ${String(body.reason ?? '')}`;
      order.payments = order.payments.map((item) => ({ ...item, status: 'refunded' }));
      order.history = [{ action: 'order.refund', actor_id: 'staff_demo', data: { reason: body.reason }, at: new Date().toISOString() }, ...order.history];
      if (order.invoice) order.credit_note = { number: `VL/CN/2026-27/${pad(orders.indexOf(order) + 1, 6)}`, url: '#demo-credit-note' };
      if (order.esim?.status === 'not_started') order.esim = { ...order.esim, status: 'expired' };
      return order;
    }
    if (parts[4] === 'invoice') {
      order.invoice = { number: `VL/2026-27/${pad(2000 + orders.indexOf(order), 6)}`, url: '#demo-invoice' };
      order.history = [{ action: 'invoice.issue', actor_id: 'staff_demo', data: {}, at: new Date().toISOString() }, ...order.history];
      return order;
    }
  }
  if (url.pathname === '/v1/admin/coupons' && method === 'GET') return coupons;
  if (url.pathname === '/v1/admin/coupons' && method === 'POST') {
    const code = String(body.code ?? '').toUpperCase();
    if (coupons.some((item) => item.code === code)) throw new DemoError(409, 'A coupon with that code already exists');
    const created: AdminCoupon = {
      code,
      kind: body.kind === 'amount' ? 'amount' : 'percent',
      value: Number(body.value),
      currency: (body.currency as string | null) ?? null,
      max_redemptions: (body.max_redemptions as number | null) ?? null,
      per_user_limit: 1,
      country_codes: (body.country_codes as string[] | undefined)?.map((item) => item.toUpperCase()) ?? [],
      starts_at: null,
      ends_at: (body.ends_at as string | null) ?? null,
      redemptions: 0,
    };
    coupons.unshift(created);
    return created;
  }
  if (parts[2] === 'coupons' && parts[3] && method === 'PATCH') {
    const coupon = coupons.find((item) => item.code === decodeURIComponent(parts[3] ?? '').toUpperCase());
    if (!coupon) throw new DemoError(404, 'Coupon not found');
    if ('ends_at' in body) coupon.ends_at = (body.ends_at as string | null) ?? null;
    return coupon;
  }
  throw new DemoError(404, 'Not available in the demo');
}

export { DemoError };
