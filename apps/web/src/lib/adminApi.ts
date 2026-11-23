'use client';

import { demoAdmin, DemoError } from './adminMock';

const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

export type StaffRole = 'support' | 'admin';

export type AdminOrderRow = {
  order_id: string;
  number: string;
  kind: 'esim' | 'top_up';
  status: string;
  plan_id: string | null;
  iccid: string | null;
  total: number;
  currency: string;
  created_at: string;
  customer: { name: string | null; phone: string | null; email: string | null };
  invoice_number: string | null;
};

export type AdminOrder = {
  order_id: string;
  number: string;
  kind: 'esim' | 'top_up';
  status: string;
  plan_id: string | null;
  top_up_pack_id: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  credit: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  referral_code: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  customer: { user_id: string; name: string | null; phone: string | null; email: string | null };
  payments: { provider: string; provider_order_id: string; provider_payment_id: string | null; status: string; amount: number }[];
  esim: { iccid: string; status: string; data_used_mb: number; data_total_mb: number; expires_at: string | null } | null;
  invoice: { number: string; url: string } | null;
  history: { action: string; actor_id: string; data: unknown; at: string }[];
};

export type AdminCoupon = {
  code: string;
  kind: 'percent' | 'amount';
  value: number;
  currency: string | null;
  max_redemptions: number | null;
  per_user_limit: number;
  country_codes: string[];
  starts_at: string | null;
  ends_at: string | null;
  redemptions: number;
};

export class AdminError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const adminConfigured = Boolean(baseUrl);

export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!baseUrl) {
    try {
      return (await demoAdmin(path, init)) as T;
    } catch (error) {
      if (error instanceof DemoError) throw new AdminError(error.status, error.message);
      throw error;
    }
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'include',
    headers: { accept: 'application/json', ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? `Request failed with ${response.status}`;
    throw new AdminError(response.status, message);
  }
  return body as T;
}

export function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export const statusTone: Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  awaiting_payment: 'neutral',
  expired: 'neutral',
  paid: 'accent',
  provisioning: 'accent',
  fulfilled: 'success',
  provisioning_failed: 'danger',
  refunded: 'warning',
};
