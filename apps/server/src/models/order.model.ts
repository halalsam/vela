import { and, count, desc, eq, ilike, inArray, isNotNull, lt, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { esim, invoice, order, profile } from '../db/schema';

export type OrderRow = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type OrderStatusValue = OrderRow['status'];

/** Orders that have not been paid yet (and may still be paid). */
export const UNPAID_STATUSES: OrderStatusValue[] = ['draft', 'awaiting_payment', 'expired'];
export const PAID_STATUSES: OrderStatusValue[] = ['paid', 'provisioning', 'fulfilled'];

export async function findOrder(db: Database, id: string): Promise<OrderRow | null> {
  const [row] = await db.select().from(order).where(eq(order.id, id));
  return row ?? null;
}

export async function findUserOrder(db: Database, userId: string, id: string): Promise<OrderRow | null> {
  const [row] = await db.select().from(order).where(and(eq(order.id, id), eq(order.userId, userId)));
  return row ?? null;
}

export async function findByIdempotencyKey(db: Database, userId: string, key: string): Promise<OrderRow | null> {
  const [row] = await db.select().from(order).where(and(eq(order.userId, userId), eq(order.idempotencyKey, key)));
  return row ?? null;
}

/** Inserts the order, or returns null when one with the same idempotency key already exists. */
export async function insertOrder(db: Database, values: NewOrder): Promise<OrderRow | null> {
  const [row] = await db.insert(order).values(values).onConflictDoNothing().returning();
  return row ?? null;
}

export async function updateOrder(db: Database, id: string, values: Partial<NewOrder>): Promise<void> {
  await db
    .update(order)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(order.id, id));
}

/** Moves the order to `to` only while it is in one of `from`; returns the updated row, or null when it was not. */
export async function transitionOrder(
  db: Database,
  id: string,
  from: OrderStatusValue[],
  to: OrderStatusValue,
  values: Partial<NewOrder> = {},
): Promise<OrderRow | null> {
  const [row] = await db
    .update(order)
    .set({ ...values, status: to, updatedAt: new Date() })
    .where(and(eq(order.id, id), inArray(order.status, from)))
    .returning();
  return row ?? null;
}

export async function listSettledWithInvoice(db: Database, userId: string, limit: number) {
  return db
    .select({ order, invoiceNumber: invoice.number })
    .from(order)
    .leftJoin(invoice, eq(invoice.orderId, order.id))
    .where(and(eq(order.userId, userId), notInArray(order.status, UNPAID_STATUSES)))
    .orderBy(desc(order.createdAt))
    .limit(limit);
}

export async function expireOlderThan(db: Database, minutes: number): Promise<number> {
  const expired = await db
    .update(order)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(inArray(order.status, ['draft', 'awaiting_payment']), lt(order.createdAt, sql`now() - make_interval(mins => ${minutes})`)))
    .returning({ id: order.id });
  return expired.length;
}

export async function countPaidEsimOrders(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(order)
    .where(and(eq(order.userId, userId), eq(order.kind, 'esim'), inArray(order.status, PAID_STATUSES)));
  return row?.value ?? 0;
}

/** The eSIM purchase that carried a referral code, for crediting the referrer. */
export async function findReferredPurchase(db: Database, esimId: string) {
  const [row] = await db
    .select({ id: order.id, userId: order.userId, referralCode: order.referralCode })
    .from(order)
    .where(and(eq(order.esimId, esimId), eq(order.kind, 'esim'), isNotNull(order.referralCode)));
  return row ?? null;
}

export type StaffOrderFilter = { status?: OrderStatusValue; q?: string; before?: Date; userId?: string; limit: number };

/** Orders for the admin list, with the customer, eSIM and invoice number. `q` matches number, phone, email or ICCID. */
export async function listForStaff(db: Database, filter: StaffOrderFilter) {
  const where: SQL[] = [];
  if (filter.userId) where.push(eq(order.userId, filter.userId));
  if (filter.status) where.push(eq(order.status, filter.status));
  if (filter.before) where.push(lt(order.createdAt, filter.before));
  if (filter.q) {
    const term = `%${filter.q.trim()}%`;
    const match = or(ilike(order.number, term), ilike(profile.phone, term), ilike(profile.email, term), ilike(esim.iccid, term));
    if (match) where.push(match);
  }
  return db
    .select({ order, name: profile.name, phone: profile.phone, email: profile.email, iccid: esim.iccid, invoice: invoice.number })
    .from(order)
    .leftJoin(profile, eq(profile.userId, order.userId))
    .leftJoin(esim, eq(esim.id, order.esimId))
    .leftJoin(invoice, eq(invoice.orderId, order.id))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(order.createdAt))
    .limit(filter.limit);
}

export async function findWithProfile(db: Database, id: string) {
  const [row] = await db.select({ order, profile }).from(order).leftJoin(profile, eq(profile.userId, order.userId)).where(eq(order.id, id));
  return row ?? null;
}

export const ORDER_STATUSES = order.status.enumValues;
