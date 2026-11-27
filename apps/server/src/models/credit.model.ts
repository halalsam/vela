import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { creditLedger, order } from '../db/schema';
import type { CurrencyCode } from '../lib/money';

export type NewCreditEntry = typeof creditLedger.$inferInsert;

/** Sum of the user's ledger in one currency (can be negative in theory; callers clamp). */
export async function ledgerTotal(db: Database, userId: string, currency: CurrencyCode): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amountMinor}), 0)::int` })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.currency, currency)));
  return row?.total ?? 0;
}

/** Adds a ledger entry once per (order, reason); returns false when it already existed. */
export async function addCreditEntry(db: Database, values: NewCreditEntry): Promise<boolean> {
  const inserted = await db.insert(creditLedger).values(values).onConflictDoNothing().returning({ id: creditLedger.id });
  return inserted.length > 0;
}

/** Referral rewards the user earned, with the friend whose order earned each. */
export async function referralEarnings(db: Database, userId: string) {
  return db
    .select({ friend: order.userId, amount: creditLedger.amountMinor, currency: creditLedger.currency })
    .from(creditLedger)
    .innerJoin(order, eq(order.id, creditLedger.orderId))
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.reason, 'referral')));
}
