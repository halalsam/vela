import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { creditNote, invoice, invoiceCounter } from '../db/schema';

export type InvoiceRow = typeof invoice.$inferSelect;
export type CreditNoteRow = typeof creditNote.$inferSelect;

export async function findInvoice(db: Database, id: string): Promise<InvoiceRow | null> {
  const [row] = await db.select().from(invoice).where(eq(invoice.id, id));
  return row ?? null;
}

export async function findInvoiceForOrder(db: Database, orderId: string): Promise<InvoiceRow | null> {
  const [row] = await db.select().from(invoice).where(eq(invoice.orderId, orderId));
  return row ?? null;
}

export async function findCreditNote(db: Database, id: string): Promise<CreditNoteRow | null> {
  const [row] = await db.select().from(creditNote).where(eq(creditNote.id, id));
  return row ?? null;
}

export async function findCreditNoteForOrder(db: Database, orderId: string): Promise<CreditNoteRow | null> {
  const [row] = await db.select().from(creditNote).where(eq(creditNote.orderId, orderId));
  return row ?? null;
}

/** Takes the next number in a gap-free sequence (call inside the transaction that stores the document). */
export async function nextSequence(db: Database, key: string): Promise<number> {
  const [counter] = await db
    .insert(invoiceCounter)
    .values({ financialYear: key, last: 1 })
    .onConflictDoUpdate({ target: invoiceCounter.financialYear, set: { last: sql`${invoiceCounter.last} + 1` } })
    .returning();
  return counter?.last ?? 1;
}

export async function insertInvoice(db: Database, values: typeof invoice.$inferInsert): Promise<InvoiceRow | null> {
  const [row] = await db.insert(invoice).values(values).returning();
  return row ?? null;
}

export async function insertCreditNote(db: Database, values: typeof creditNote.$inferInsert): Promise<CreditNoteRow | null> {
  const [row] = await db.insert(creditNote).values(values).returning();
  return row ?? null;
}
