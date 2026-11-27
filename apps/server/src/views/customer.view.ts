import type { EsimRow } from '../models/esim.model';
import type { ProfileRow } from '../models/profile.model';
import type { ConversationRow, RatingRow } from '../models/support.model';
import type { AuditRow } from '../models/audit.model';
import { fromMinor, type CurrencyCode } from '../lib/money';
import type { StaffOrderItem } from './admin.view';
import { historyView } from './admin.view';
import { esimRef } from './support.view';

export type Spend = { currency: string; total: number };
export type SpendSummary = { orders: number; lastOrderAt: Date | null; spend: Spend[] };

export function customerListItem(row: ProfileRow, conversation: ConversationRow['status'] | null, money: SpendSummary | undefined, tags: string[]) {
  return {
    user_id: row.userId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    language: row.language,
    joined_at: row.createdAt.toISOString(),
    orders: money?.orders ?? 0,
    spend: money?.spend ?? [],
    last_order_at: money?.lastOrderAt?.toISOString() ?? null,
    tags,
    conversation: conversation ?? null,
  };
}

/** One eSIM as staff see it on a customer or a chat. */
export function staffEsim(item: EsimRow) {
  return {
    iccid: item.iccid,
    label: item.label,
    plan_id: item.planId,
    status: item.status,
    data_used_mb: item.dataUsedMb,
    data_total_mb: item.dataTotalMb,
    activated_at: item.activatedAt?.toISOString() ?? null,
    expires_at: item.expiresAt?.toISOString() ?? null,
  };
}

export function customerDetailView(input: {
  profile: ProfileRow;
  referrals: number;
  tags: string[];
  money: SpendSummary | undefined;
  credit: { currency: CurrencyCode; total: number }[];
  devices: { platform: string; locale: string; lastSeenAt: Date }[];
  orders: StaffOrderItem[];
  esims: EsimRow[];
  conversations: ConversationRow[];
  labels: Map<string, string>;
  ratings: RatingRow[];
  history: AuditRow[];
}) {
  const row = input.profile;
  return {
    user_id: row.userId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    language: row.language,
    currency: row.currency,
    role: row.role,
    joined_at: row.createdAt.toISOString(),
    referral_code: row.referralCode,
    referred_by: row.referredBy,
    referrals: input.referrals,
    tags: input.tags,
    orders_count: input.money?.orders ?? 0,
    spend: input.money?.spend ?? [],
    last_order_at: input.money?.lastOrderAt?.toISOString() ?? null,
    credit: input.credit.filter((item) => item.total !== 0).map((item) => ({ currency: item.currency, amount: fromMinor(item.total, item.currency) })),
    devices: input.devices.map((item) => ({ platform: item.platform, locale: item.locale, last_seen_at: item.lastSeenAt.toISOString() })),
    orders: input.orders,
    esims: input.esims.map(staffEsim),
    conversations: input.conversations.map((item) => ({
      id: item.id,
      number: item.number,
      status: item.status,
      esim: esimRef(item.iccid, input.labels),
      assignee_id: item.assigneeId,
      last_message_at: item.lastMessageAt.toISOString(),
    })),
    ratings: input.ratings.map((item) => ({ score: item.score, comment: item.comment, at: item.createdAt.toISOString() })),
    history: input.history.map(historyView),
  };
}
