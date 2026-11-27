'use client';

import type { BlogPost, SeoPage, SeoSite } from '@vela/api';
import { demoAdmin, DemoError, demoUpload } from './adminMock';

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
  customer: { user_id?: string; name: string | null; phone: string | null; email: string | null };
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
  credit_note?: { number: string; url: string } | null;
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

export type AdminBlogPost = Omit<BlogPost, 'published_at'> & {
  id: string;
  status: 'draft' | 'published';
  /** Null until first published. A future date means scheduled. */
  published_at: string | null;
  created_at: string;
};

export type AdminSeo = { site: SeoSite; pages: SeoPage[] };

export type BlogState = 'draft' | 'scheduled' | 'published';

export function blogState(post: Pick<AdminBlogPost, 'status' | 'published_at'>): BlogState {
  if (post.status === 'draft') return 'draft';
  return post.published_at && Date.parse(post.published_at) > Date.now() ? 'scheduled' : 'published';
}

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

export type AdminUpload = {
  id: string;
  url: string;
  driver: 's3' | 'disk' | 'demo';
  content_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  original_name: string;
  alt: string;
  created_at: string;
};

export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const UPLOAD_MAX_MB = 8;

/** https links, site paths and plain-http localhost (a dev API's uploads). Demo mode keeps images in the browser. */
export function isImageUrl(value: string): boolean {
  return (
    value.startsWith('/') ||
    /^https:\/\//.test(value) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(value) ||
    (!adminConfigured && value.startsWith('blob:'))
  );
}

/** Sends one image to S3 (or the server's disk, when S3 isn't set or fails). */
export async function adminUpload(file: File, alt = ''): Promise<AdminUpload> {
  if (!UPLOAD_TYPES.includes(file.type)) throw new AdminError(415, 'Upload a JPG, PNG, WebP, GIF or AVIF image.');
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024) throw new AdminError(413, `Images can be up to ${UPLOAD_MAX_MB} MB.`);
  if (!baseUrl) return demoUpload(file, alt);
  const body = new FormData();
  body.set('file', file);
  if (alt) body.set('alt', alt);
  const response = await fetch(`${baseUrl}/v1/admin/uploads`, { method: 'POST', credentials: 'include', headers: { accept: 'application/json' }, body });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (result as { error?: { message?: string } } | null)?.error?.message ?? (response.status === 413 ? 'That image is too big.' : `Upload failed with ${response.status}`);
    throw new AdminError(response.status, message);
  }
  return result as AdminUpload;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet';
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

export type ConversationStatus = 'open' | 'pending' | 'resolved';
export type StaffRef = { user_id: string; name: string };

export type ChatPlan = { iccid: string; label: string } | null;

export type AdminConversationRow = {
  id: string;
  number: number;
  user_id: string;
  esim: ChatPlan;
  customer: { name: string | null; phone: string | null; email: string | null; language: string };
  status: ConversationStatus;
  assignee: StaffRef | null;
  last_message: { text: string; from: 'agent' | 'user'; internal: boolean; at: string } | null;
  unread: number;
  waiting_since: string | null;
  last_message_at: string;
};

export type AdminEsimSummary = {
  iccid: string;
  label: string;
  plan_id?: string;
  status: string;
  data_used_mb: number;
  data_total_mb: number;
  activated_at?: string | null;
  expires_at: string | null;
};

export type AdminOtherChat = { id: string; number: number; status: ConversationStatus; esim: ChatPlan; last_message_at: string };

export type AdminConversation = {
  id: string;
  number: number;
  user_id: string;
  status: ConversationStatus;
  esim: ChatPlan;
  other_chats: AdminOtherChat[];
  assignee: StaffRef | null;
  resolved_at: string | null;
  rating_requested: boolean;
  last_rating: { score: number; comment: string | null; at: string } | null;
  customer: { name: string | null; phone: string | null; email: string | null; language: string; joined_at: string; tags: string[] };
  messages: { id: string; from: 'agent' | 'user'; text: string; internal: boolean; staff: StaffRef | null; at: string }[];
  orders: AdminOrderRow[];
  esims: AdminEsimSummary[];
};

export type SupportStats = {
  open: number;
  pending: number;
  unassigned: number;
  resolved_24h: number;
  median_first_reply_minutes: number | null;
  rating_30d: { average: number; count: number } | null;
};

export type SavedReply = { id: string; title: string; body: string; updated_at: string };
export type AdminStaff = { user_id: string; name: string; role: StaffRole };

export const ACTIVITIES = {
  active_esim: 'Has an active eSIM',
  expiring_3d: 'Plan ends in 3 days',
  bought_30d: 'Bought in the last 30 days',
  lapsed_90d: 'No purchase in 90 days',
  never_bought: 'Never bought',
} as const;
export type Activity = keyof typeof ACTIVITIES;

export type CustomerFilter = { q?: string; tag?: string; language?: 'en' | 'ar'; activity?: Activity; country?: string };

export type Spend = { currency: string; total: number };

export type AdminCustomerRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  language: string;
  joined_at: string;
  orders: number;
  spend: Spend[];
  last_order_at: string | null;
  tags: string[];
  conversation: ConversationStatus | null;
};

export type AdminCustomer = {
  user_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  language: string;
  currency: string;
  role: string;
  joined_at: string;
  referral_code: string;
  referred_by: string | null;
  referrals: number;
  tags: string[];
  orders_count: number;
  spend: Spend[];
  last_order_at: string | null;
  credit: { currency: string; amount: number }[];
  devices: { platform: string; locale: string; last_seen_at: string }[];
  orders: AdminOrderRow[];
  esims: AdminEsimSummary[];
  conversations: (AdminOtherChat & { assignee_id: string | null })[];
  ratings: { score: number; comment: string | null; at: string }[];
  history: { action: string; actor_id: string; data: unknown; at: string }[];
};

export type AdminBroadcast = {
  id: string;
  title: string;
  body: string;
  title_ar: string | null;
  body_ar: string | null;
  segment: CustomerFilter;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  audience: number;
  reached: number;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  error: string | null;
};

export const conversationTone: Record<ConversationStatus, 'accent' | 'neutral' | 'success'> = { open: 'accent', pending: 'neutral', resolved: 'success' };
export const conversationLabel: Record<ConversationStatus, string> = { open: 'Needs reply', pending: 'Waiting on customer', resolved: 'Resolved' };

export function filterParams(filter: CustomerFilter): Record<string, string> {
  return Object.fromEntries(Object.entries(filter).filter(([, value]) => typeof value === 'string' && value.trim() !== '')) as Record<string, string>;
}

export function describeSegment(filter: CustomerFilter): string {
  const parts = [
    filter.activity ? ACTIVITIES[filter.activity] : null,
    filter.tag ? `tagged “${filter.tag}”` : null,
    filter.language ? (filter.language === 'ar' ? 'Arabic speakers' : 'English speakers') : null,
    filter.country ? `bought ${filter.country.toUpperCase()}` : null,
    filter.q ? `matching “${filter.q}”` : null,
  ].filter(Boolean);
  return parts.length === 0 ? 'All customers' : parts.join(' · ');
}

export function spendLabel(spend: Spend[]): string {
  return spend.length === 0 ? 'None' : spend.map((item) => money(item.total, item.currency)).join(' + ');
}

/** "4m", "3h", "2d" since a time. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function personName(person: { name: string | null; phone: string | null; email: string | null }): string {
  return person.name ?? person.phone ?? person.email ?? 'Unknown traveller';
}
