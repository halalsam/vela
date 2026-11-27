import { and, asc, count, desc, eq, inArray, isNull, lt, max, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { creditLedger, customerTag, device, esim, order, profile } from '../db/schema';
import { mostUrgentStatus } from './support.model';

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

const fulfilledOrder = sql`${order.status} in ('fulfilled', 'refunded')`;
const hasDevice = sql`exists (select 1 from ${device} where ${device.userId} = ${profile.userId})`;

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

/** Customers matching a filter, newest account first, with the status of their most urgent chat. */
export async function findCustomers(db: Database, filter: CustomerFilter & { before?: Date; limit: number }) {
  const where = customerConditions(filter);
  if (filter.before) where.push(lt(profile.createdAt, filter.before));
  return db
    .select({ profile, conversation: mostUrgentStatus(profile.userId) })
    .from(profile)
    .where(and(...where))
    .orderBy(desc(profile.createdAt))
    .limit(filter.limit);
}

export async function countCustomers(db: Database, filter: CustomerFilter, options: { reachableOnly?: boolean } = {}): Promise<number> {
  const where = customerConditions(filter);
  if (options.reachableOnly) where.push(hasDevice);
  const [row] = await db
    .select({ value: count() })
    .from(profile)
    .where(and(...where));
  return row?.value ?? 0;
}

/** Pages through the customers of a filter who have a push device, by user id. */
export async function reachableCustomerIds(db: Database, filter: CustomerFilter, after: string | null, limit: number): Promise<string[]> {
  const where = [...customerConditions(filter), hasDevice];
  if (after) where.push(sql`${profile.userId} > ${after}`);
  const rows = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(and(...where))
    .orderBy(asc(profile.userId))
    .limit(limit);
  return rows.map((row) => row.userId);
}

/** Order count, fulfilled spend and last order per user and currency (fulfilled or refunded orders). */
export async function spendRows(db: Database, userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
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
}

export async function creditByCurrency(db: Database, userId: string) {
  return db
    .select({ currency: creditLedger.currency, total: sql<number>`coalesce(sum(${creditLedger.amountMinor}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .groupBy(creditLedger.currency);
}

export async function devicesBySeen(db: Database, userId: string) {
  return db.select().from(device).where(eq(device.userId, userId)).orderBy(desc(device.lastSeenAt));
}

export async function userEsims(db: Database, userId: string, limit?: number) {
  const query = db.select().from(esim).where(eq(esim.userId, userId)).orderBy(desc(esim.createdAt));
  return limit ? query.limit(limit) : query;
}

/** How many profiles have `referredBy` equal to `value`. */
export async function countReferredBy(db: Database, value: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(profile).where(eq(profile.referredBy, value));
  return row?.value ?? 0;
}

/* Tags. */

export async function tagRows(db: Database, userIds: string[]) {
  if (userIds.length === 0) return [];
  return db.select().from(customerTag).where(inArray(customerTag.userId, userIds)).orderBy(asc(customerTag.tag));
}

export async function replaceTags(db: Database, userId: string, tags: string[]): Promise<void> {
  await db.delete(customerTag).where(eq(customerTag.userId, userId));
  if (tags.length > 0) await db.insert(customerTag).values(tags.map((tag) => ({ userId, tag })));
}

export async function tagCounts(db: Database) {
  return db.select({ tag: customerTag.tag, customers: count() }).from(customerTag).groupBy(customerTag.tag).orderBy(asc(customerTag.tag));
}
