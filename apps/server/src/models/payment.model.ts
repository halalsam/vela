import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { payment, webhookEvent } from '../db/schema';

export type PaymentRow = typeof payment.$inferSelect;
export type NewPayment = typeof payment.$inferInsert;
type WebhookSource = typeof webhookEvent.$inferSelect.source;

export async function latestPaymentFor(db: Database, orderId: string): Promise<PaymentRow | null> {
  const [row] = await db.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(desc(payment.createdAt)).limit(1);
  return row ?? null;
}

/** The newest payment for the order that took money (captured, or already refunded). */
export async function latestSettledPaymentFor(db: Database, orderId: string): Promise<PaymentRow | null> {
  const [row] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), inArray(payment.status, ['captured', 'refunded'])))
    .orderBy(desc(payment.createdAt))
    .limit(1);
  return row ?? null;
}

export async function paymentsFor(db: Database, orderId: string): Promise<PaymentRow[]> {
  return db.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(desc(payment.createdAt));
}

export async function findByProviderOrder(db: Database, provider: PaymentRow['provider'], providerOrderId: string): Promise<PaymentRow | null> {
  const [row] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.provider, provider), eq(payment.providerOrderId, providerOrderId)));
  return row ?? null;
}

export async function insertPayment(db: Database, values: NewPayment): Promise<void> {
  await db.insert(payment).values(values);
}

export async function updatePayment(db: Database, id: string, values: Partial<NewPayment>): Promise<void> {
  await db
    .update(payment)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(payment.id, id));
}

export async function markFailedByProviderOrder(db: Database, providerOrderId: string, providerPaymentId: string): Promise<void> {
  await db
    .update(payment)
    .set({ status: 'failed', providerPaymentId, updatedAt: new Date() })
    .where(and(eq(payment.providerOrderId, providerOrderId), eq(payment.status, 'created')));
}

export async function markRefundedByProviderPayment(db: Database, providerPaymentId: string): Promise<void> {
  await db.update(payment).set({ status: 'refunded', updatedAt: new Date() }).where(eq(payment.providerPaymentId, providerPaymentId));
}

/* Webhook events: stored once per (source, event id) so retries are not processed twice. */

export async function recordWebhookEvent(
  db: Database,
  event: { source: WebhookSource; eventId: string; type: string; payload: object },
): Promise<typeof webhookEvent.$inferSelect | null> {
  await db.insert(webhookEvent).values(event).onConflictDoNothing();
  const [stored] = await db
    .select()
    .from(webhookEvent)
    .where(and(eq(webhookEvent.source, event.source), eq(webhookEvent.eventId, event.eventId)));
  return stored ?? null;
}

export async function finishWebhookEvent(db: Database, source: WebhookSource, eventId: string, error: string | null): Promise<void> {
  const match = and(eq(webhookEvent.source, source), eq(webhookEvent.eventId, eventId));
  await db.update(webhookEvent).set(error === null ? { processedAt: new Date(), error: null } : { error }).where(match);
}
