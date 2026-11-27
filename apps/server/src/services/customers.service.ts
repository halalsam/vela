import type { Database } from '../db/client';
import { HttpError, notFound } from '../lib/errors';
import { fromMinor } from '../lib/money';
import * as audits from '../models/audit.model';
import * as customers from '../models/customer.model';
import * as profiles from '../models/profile.model';
import * as support from '../models/support.model';
import { customerDetailView, customerListItem, type SpendSummary } from '../views/customer.view';
import { listOrders } from './admin.service';
import { esimLabels } from './support.service';

export { ACTIVITIES, type Activity, type CustomerFilter } from '../models/customer.model';

const TAG_PATTERN = /^[a-z0-9][a-z0-9 -]{0,29}$/;
const MAX_TAGS = 12;

export function normaliseTag(value: string): string {
  const tag = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!TAG_PATTERN.test(tag)) throw new HttpError(422, 'invalid_tag', 'Tags are 1 to 30 letters, numbers, spaces or hyphens');
  return tag;
}

async function spendFor(db: Database, userIds: string[]): Promise<Map<string, SpendSummary>> {
  const out = new Map<string, SpendSummary>();
  for (const row of await customers.spendRows(db, userIds)) {
    const entry = out.get(row.userId) ?? { orders: 0, lastOrderAt: null, spend: [] };
    entry.orders += row.orders;
    if (row.last && (!entry.lastOrderAt || row.last > entry.lastOrderAt)) entry.lastOrderAt = row.last;
    if (row.total > 0) entry.spend.push({ currency: row.currency, total: fromMinor(row.total, row.currency) });
    out.set(row.userId, entry);
  }
  return out;
}

async function tagsFor(db: Database, userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const row of await customers.tagRows(db, userIds)) out.set(row.userId, [...(out.get(row.userId) ?? []), row.tag]);
  return out;
}

export async function listCustomers(db: Database, filter: customers.CustomerFilter & { before?: Date; limit: number }) {
  const [rows, total] = await Promise.all([customers.findCustomers(db, filter), customers.countCustomers(db, filter)]);
  const ids = rows.map((row) => row.profile.userId);
  const [spend, tags] = await Promise.all([spendFor(db, ids), tagsFor(db, ids)]);
  return {
    total,
    customers: rows.map((row) => customerListItem(row.profile, row.conversation, spend.get(row.profile.userId), tags.get(row.profile.userId) ?? [])),
  };
}

export async function customerDetail(db: Database, userId: string) {
  const row = await profiles.findProfile(db, userId);
  if (!row) throw notFound('Customer');
  const [orders, esims, credit, devices, tags, conversations, ratings, history, referrals, spend] = await Promise.all([
    listOrders(db, { userId, limit: 50 }),
    customers.userEsims(db, userId),
    customers.creditByCurrency(db, userId),
    customers.devicesBySeen(db, userId),
    tagsFor(db, [userId]),
    support.userConversations(db, userId, 30),
    support.userRatings(db, userId, 10),
    audits.auditFor(db, `user:${userId}`, 50),
    customers.countReferredBy(db, row.userId),
    spendFor(db, [userId]),
  ]);
  const labels = await esimLabels(
    db,
    conversations.map((item) => item.iccid),
  );
  return customerDetailView({
    profile: row,
    referrals,
    tags: tags.get(userId) ?? [],
    money: spend.get(userId),
    credit,
    devices,
    orders,
    esims,
    conversations,
    labels,
    ratings,
    history,
  });
}

export async function setTags(db: Database, actorId: string, userId: string, input: string[]) {
  if (!(await profiles.findProfile(db, userId))) throw notFound('Customer');
  const tags = [...new Set(input.map(normaliseTag))];
  if (tags.length > MAX_TAGS) throw new HttpError(422, 'too_many_tags', `A customer can have up to ${MAX_TAGS} tags`);
  const before = (await tagsFor(db, [userId])).get(userId) ?? [];
  await customers.replaceTags(db, userId, tags);
  const added = tags.filter((tag) => !before.includes(tag));
  const removed = before.filter((tag) => !tags.includes(tag));
  if (added.length + removed.length > 0) await audits.audit(db, actorId, 'customer.tags', `user:${userId}`, { added, removed });
  return tags.sort();
}

export async function allTags(db: Database) {
  return customers.tagCounts(db);
}

/** Customers in a filter, and how many of them have a device that can get a push. */
export async function audienceSize(db: Database, filter: customers.CustomerFilter) {
  const [all, reachable] = await Promise.all([customers.countCustomers(db, filter), customers.countCustomers(db, filter, { reachableOnly: true })]);
  return { customers: all, reachable };
}

/** Pages through the reachable customers of a filter, by user id. */
export async function reachableIds(db: Database, filter: customers.CustomerFilter, after: string | null, limit: number) {
  return customers.reachableCustomerIds(db, filter, after, limit);
}
