import { and, asc, count, desc, eq, inArray, isNull, lt, max, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  auditLog,
  creditLedger,
  customerTag,
  device,
  esim,
  order,
  profile,
  supportConversation,
  supportRating,
} from '../../db/schema';
import { HttpError, notFound } from '../../lib/errors';
import { fromMinor } from '../../lib/money';
import { listOrders } from '../admin/admin';
import { esimLabels } from '../support/support';

export const ACTIVITIES = ['active_esim', 'expiring_3d', 'bought_30d', 'never_bought', 'lapsed_90d'] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Who a customer list or a broadcast is for. Every field narrows the set. */
export type CustomerFilter = {
  q?: string;
  tag?: string;
  language?: 'en' | 'ar';
  activity?: Activity;
  /** ISO country code of a plan they bought. */
  country?: string;
};

const TAG_PATTERN = /^[a-z0-9][a-z0-9 -]{0,29}$/;

export function normaliseTag(value: string): string {
  const tag = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!TAG_PATTERN.test(tag)) throw new HttpError(422, 'invalid_tag', 'Tags are 1 to 30 letters, numbers, spaces or hyphens');
  return tag;
}

const fulfilledOrder = sql`${order.status} in ('fulfilled', 'refunded')`;

/** Conditions on `profile` for a filter. Staff and deleted accounts are never included. */
export function customerConditions(filter: CustomerFilter): SQL[] {
  const where: SQL[] = [eq(profile.role, 'customer'), isNull(profile.deletedAt)];
  if (filter.q?.trim()) {
    const term = `%${filter.q.trim()}%`;
    where.push(sql`(
      ${profile.name} ilike ${term} or ${profile.phone} ilike ${term} or ${profile.email} ilike ${term}
      or exists (select 1 from ${order} where ${order.userId} = ${profile.userId} and ${order.number} ilike ${term})
      or exists (select 1 from ${esim} where ${esim.userId} = ${profile.userId} and ${esim.iccid} ilike ${term})
    )`);
  }
  if (filter.tag) where.push(sql`exists (select 1 from ${customerTag} where ${customerTag.userId} = ${profile.userId} and ${customerTag.tag} = ${filter.tag})`);
  if (filter.language === 'ar') where.push(sql`${profile.language} ilike 'ar%'`);
  if (filter.language === 'en') where.push(sql`${profile.language} not ilike 'ar%'`);
  if (filter.country) {
    where.push(
      sql`exists (select 1 from ${order} join plan on plan.id = ${order.planId} where ${order.userId} = ${profile.userId} and ${fulfilledOrder} and ${filter.country.toUpperCase()} = any(plan.country_codes))`,
    );
  }
  switch (filter.activity) {
    case 'active_esim':
      where.push(
        sql`exists (select 1 from ${esim} where ${esim.userId} = ${profile.userId} and ${esim.status} in ('active', 'not_started') and (${esim.expiresAt} is null or ${esim.expiresAt} > now()))`,
      );
      break;
    case 'expiring_3d':
      where.push(
        sql`exists (select 1 from ${esim} where ${esim.userId} = ${profile.userId} and ${esim.status} = 'active' and ${esim.expiresAt} between now() and now() + interval '3 days')`,
      );
      break;
    case 'bought_30d':
      where.push(sql`exists (select 1 from ${order} where ${order.userId} = ${profile.userId} and ${fulfilledOrder} and ${order.createdAt} > now() - interval '30 days')`);
      break;
    case 'never_bought':
      where.push(sql`not exists (select 1 from ${order} where ${order.userId} = ${profile.userId} and ${fulfilledOrder})`);
      break;
    case 'lapsed_90d':
      where.push(sql`exists (select 1 from ${order} where ${order.userId} = ${profile.userId} and ${fulfilledOrder})`);
      where.push(sql`not exists (select 1 from ${order} where ${order.userId} = ${profile.userId} and ${fulfilledOrder} and ${order.createdAt} > now() - interval '90 days')`);
      break;
    default:
      break;
  }
  return where;
}

type Spend = { currency: string; total: number };

async function spendFor(db: Database, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { orders: number; lastOrderAt: Date | null; spend: Spend[] }>();
  const rows = await db
    .select({
      userId: order.userId,
      currency: order.currency,
      orders: count(),
      total: sql<number>`coalesce(sum(${order.totalMinor}) filter (where ${order.status} = 'fulfilled'), 0)::int`,
      last: max(order.createdAt),
    })
    .from(order)
    .where(and(inArray(order.userId, userIds), fulfilledOrder))
    .groupBy(order.userId, order.currency);
  const out = new Map<string, { orders: number; lastOrderAt: Date | null; spend: Spend[] }>();
  for (const row of rows) {
    const entry = out.get(row.userId) ?? { orders: 0, lastOrderAt: null, spend: [] };
    entry.orders += row.orders;
    if (row.last && (!entry.lastOrderAt || row.last > entry.lastOrderAt)) entry.lastOrderAt = row.last;
    if (row.total > 0) entry.spend.push({ currency: row.currency, total: fromMinor(row.total, row.currency) });
    out.set(row.userId, entry);
  }
  return out;
}

async function tagsFor(db: Database, userIds: string[]) {
  const out = new Map<string, string[]>();
  if (userIds.length === 0) return out;
  const rows = await db.select().from(customerTag).where(inArray(customerTag.userId, userIds)).orderBy(asc(customerTag.tag));
  for (const row of rows) out.set(row.userId, [...(out.get(row.userId) ?? []), row.tag]);
  return out;
}

export async function listCustomers(db: Database, filter: CustomerFilter & { before?: Date; limit: number }) {
  const where = customerConditions(filter);
  if (filter.before) where.push(lt(profile.createdAt, filter.before));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        profile,
        // The chat that most needs attention: open, then waiting on the customer, then resolved.
        conversation: sql<'open' | 'pending' | 'resolved' | null>`(
          select ${supportConversation.status} from ${supportConversation} where ${supportConversation.userId} = ${profile.userId}
          order by case ${supportConversation.status} when 'open' then 0 when 'pending' then 1 else 2 end limit 1
        )`,
      })
      .from(profile)
      .where(and(...where))
      .orderBy(desc(profile.createdAt))
      .limit(filter.limit),
    db
      .select({ value: count() })
      .from(profile)
      .where(and(...customerConditions(filter))),
  ]);
  const ids = rows.map((row) => row.profile.userId);
  const [spend, tags] = await Promise.all([spendFor(db, ids), tagsFor(db, ids)]);
  return {
    total: total?.value ?? 0,
    customers: rows.map((row) => {
      const money = spend.get(row.profile.userId);
      return {
        user_id: row.profile.userId,
        name: row.profile.name,
        phone: row.profile.phone,
        email: row.profile.email,
        language: row.profile.language,
        joined_at: row.profile.createdAt.toISOString(),
        orders: money?.orders ?? 0,
        spend: money?.spend ?? [],
        last_order_at: money?.lastOrderAt?.toISOString() ?? null,
        tags: tags.get(row.profile.userId) ?? [],
        conversation: row.conversation ?? null,
      };
    }),
  };
}

export async function customerDetail(db: Database, userId: string) {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!row) throw notFound('Customer');
  const [orders, esims, credit, devices, tags, conversation, ratings, history, referred, spend] = await Promise.all([
    listOrders(db, { userId, limit: 50 }),
    db.select().from(esim).where(eq(esim.userId, userId)).orderBy(desc(esim.createdAt)),
    db
      .select({ currency: creditLedger.currency, total: sql<number>`coalesce(sum(${creditLedger.amountMinor}), 0)::int` })
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .groupBy(creditLedger.currency),
    db.select().from(device).where(eq(device.userId, userId)).orderBy(desc(device.lastSeenAt)),
    tagsFor(db, [userId]),
    db.select().from(supportConversation).where(eq(supportConversation.userId, userId)).orderBy(desc(supportConversation.lastMessageAt)).limit(30),
    db.select().from(supportRating).where(eq(supportRating.userId, userId)).orderBy(desc(supportRating.createdAt)).limit(10),
    db.select().from(auditLog).where(eq(auditLog.target, `user:${userId}`)).orderBy(desc(auditLog.createdAt)).limit(50),
    db.select({ value: count() }).from(profile).where(eq(profile.referredBy, row.referralCode)),
    spendFor(db, [userId]),
  ]);
  const labels = await esimLabels(
    db,
    conversation.map((item) => item.iccid),
  );
  const money = spend.get(userId);
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
    referrals: referred[0]?.value ?? 0,
    tags: tags.get(userId) ?? [],
    orders_count: money?.orders ?? 0,
    spend: money?.spend ?? [],
    last_order_at: money?.lastOrderAt?.toISOString() ?? null,
    credit: credit.filter((item) => item.total !== 0).map((item) => ({ currency: item.currency, amount: fromMinor(item.total, item.currency) })),
    devices: devices.map((item) => ({ platform: item.platform, locale: item.locale, last_seen_at: item.lastSeenAt.toISOString() })),
    orders,
    esims: esims.map((item) => ({
      iccid: item.iccid,
      label: item.label,
      plan_id: item.planId,
      status: item.status,
      data_used_mb: item.dataUsedMb,
      data_total_mb: item.dataTotalMb,
      activated_at: item.activatedAt?.toISOString() ?? null,
      expires_at: item.expiresAt?.toISOString() ?? null,
    })),
    conversations: conversation.map((item) => ({
      id: item.id,
      number: item.number,
      status: item.status,
      esim: item.iccid ? { iccid: item.iccid, label: labels.get(item.iccid) ?? item.iccid } : null,
      assignee_id: item.assigneeId,
      last_message_at: item.lastMessageAt.toISOString(),
    })),
    ratings: ratings.map((item) => ({ score: item.score, comment: item.comment, at: item.createdAt.toISOString() })),
    history: history.map((item) => ({ action: item.action, actor_id: item.actorId, data: item.data, at: item.createdAt.toISOString() })),
  };
}

export async function setTags(db: Database, actorId: string, userId: string, input: string[]) {
  const [row] = await db.select({ userId: profile.userId }).from(profile).where(eq(profile.userId, userId));
  if (!row) throw notFound('Customer');
  const tags = [...new Set(input.map(normaliseTag))];
  if (tags.length > 12) throw new HttpError(422, 'too_many_tags', 'A customer can have up to 12 tags');
  const before = (await tagsFor(db, [userId])).get(userId) ?? [];
  await db.delete(customerTag).where(eq(customerTag.userId, userId));
  if (tags.length > 0) await db.insert(customerTag).values(tags.map((tag) => ({ userId, tag })));
  const added = tags.filter((tag) => !before.includes(tag));
  const removed = before.filter((tag) => !tags.includes(tag));
  if (added.length + removed.length > 0) {
    await db.insert(auditLog).values({ actorId, action: 'customer.tags', target: `user:${userId}`, data: { added, removed } });
  }
  return tags.sort();
}

export async function allTags(db: Database) {
  const rows = await db.select({ tag: customerTag.tag, customers: count() }).from(customerTag).groupBy(customerTag.tag).orderBy(asc(customerTag.tag));
  return rows;
}

/** Customers in a filter, and how many of them have a device that can get a push. */
export async function audienceSize(db: Database, filter: CustomerFilter) {
  const [all] = await db
    .select({ value: count() })
    .from(profile)
    .where(and(...customerConditions(filter)));
  const [reachable] = await db
    .select({ value: count() })
    .from(profile)
    .where(and(...customerConditions(filter), sql`exists (select 1 from ${device} where ${device.userId} = ${profile.userId})`));
  return { customers: all?.value ?? 0, reachable: reachable?.value ?? 0 };
}

/** Pages through the reachable customers of a filter, oldest account first. */
export async function reachableIds(db: Database, filter: CustomerFilter, after: string | null, limit: number) {
  const where = [...customerConditions(filter), sql`exists (select 1 from ${device} where ${device.userId} = ${profile.userId})`];
  if (after) where.push(sql`${profile.userId} > ${after}`);
  const rows = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(and(...where))
    .orderBy(asc(profile.userId))
    .limit(limit);
  return rows.map((row) => row.userId);
}
