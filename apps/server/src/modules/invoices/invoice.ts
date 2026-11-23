import { createHmac } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { creditNote, invoice, invoiceCounter, order, plan, profile, topUpPack } from '../../db/schema';
import type { Env } from '../../env';
import { fromMinor, type CurrencyCode } from '../../lib/money';
import type { Logger } from '../../logger';
import { safeEqual } from '../payments/razorpay';

const IST_OFFSET_MS = 330 * 60_000;
const LINK_TTL_SECONDS = 15 * 60;

export type InvoiceData = {
  number: string;
  kind?: 'invoice' | 'credit_note';
  againstInvoice?: string;
  issuedAt: string;
  orderNumber: string;
  seller: { name: string; gstin: string | null; address: string; state: string };
  buyer: { name: string; email: string | null; phone: string | null };
  placeOfSupply: string;
  sac: string;
  currency: CurrencyCode;
  description: string;
  subtotal: number;
  discount: number;
  credit: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function invoiceNumber(prefix: string, year: string, sequence: number): string {
  return `${prefix}/${year}/${String(sequence).padStart(6, '0')}`;
}

function describe(row: typeof plan.$inferSelect | undefined, pack: typeof topUpPack.$inferSelect | undefined, kind: string): string {
  const size = (mb: number) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`);
  const scope = row ? (row.type === 'country' ? row.countryCodes.join(', ') : (row.regionId ?? row.type).toUpperCase()) : '';
  if (kind === 'top_up' && pack) return `eSIM data top-up, ${size(pack.dataMb)}${pack.extraDays ? ` and ${pack.extraDays} days` : ''} (${scope})`;
  return row ? `eSIM data plan, ${size(row.dataMb)} for ${row.validityDays} days (${scope})` : 'eSIM data plan';
}

export async function issueInvoice(db: Database, env: Env, logger: Logger, orderId: string): Promise<typeof invoice.$inferSelect | null> {
  const [existing] = await db.select().from(invoice).where(eq(invoice.orderId, orderId));
  if (existing) return existing;
  const [row] = await db.select().from(order).where(eq(order.id, orderId));
  if (!row || row.status !== 'fulfilled') return null;
  if (row.currency !== 'INR') {
    logger.info({ orderId, currency: row.currency }, 'no GST invoice for a non-INR order');
    return null;
  }
  const [planRow] = row.planId ? await db.select().from(plan).where(eq(plan.id, row.planId)) : [];
  const [pack] = row.topUpPackId ? await db.select().from(topUpPack).where(eq(topUpPack.id, row.topUpPackId)) : [];
  const [buyer] = await db.select().from(profile).where(eq(profile.userId, row.userId));
  const issuedAt = new Date();
  const year = financialYear(issuedAt);
  const state = env.SELLER_STATE || 'Not set';
  const half = Math.floor(row.taxMinor / 2);

  return db.transaction(async (tx) => {
    const [counter] = await tx
      .insert(invoiceCounter)
      .values({ financialYear: year, last: 1 })
      .onConflictDoUpdate({ target: invoiceCounter.financialYear, set: { last: sql`${invoiceCounter.last} + 1` } })
      .returning();
    const number = invoiceNumber(env.INVOICE_PREFIX, year, counter?.last ?? 1);
    const money = (minor: number) => fromMinor(minor, row.currency);
    const data: InvoiceData = {
      number,
      issuedAt: issuedAt.toISOString(),
      orderNumber: row.number,
      seller: { name: env.SELLER_NAME, gstin: env.SELLER_GSTIN ?? null, address: env.SELLER_ADDRESS, state },
      buyer: { name: buyer?.name ?? 'Traveller', email: buyer?.email ?? null, phone: buyer?.phone ?? null },
      placeOfSupply: state,
      sac: env.INVOICE_SAC,
      currency: row.currency,
      description: describe(planRow, pack, row.kind),
      subtotal: money(row.subtotalMinor),
      discount: money(row.discountMinor),
      credit: money(row.creditMinor),
      taxable: money(row.totalMinor - row.taxMinor),
      cgst: money(half),
      sgst: money(row.taxMinor - half),
      igst: 0,
      total: money(row.totalMinor),
    };
    const [stored] = await tx
      .insert(invoice)
      .values({ orderId, number, gstin: data.seller.gstin, placeOfSupply: data.placeOfSupply, data, issuedAt })
      .returning();
    logger.info({ orderId, number }, 'invoice issued');
    return stored ?? null;
  });
}

export type DocumentKind = 'invoices' | 'credit-notes';

function linkSignature(secret: string, kind: DocumentKind, id: string, expires: number): string {
  const scope = kind === 'invoices' ? 'invoice' : 'credit-note';
  return createHmac('sha256', secret).update(`${scope}:${id}:${expires}`).digest('base64url');
}

export function invoiceLink(env: Env, id: string, now = Date.now(), options: { kind?: DocumentKind; ttlSeconds?: number } = {}): { url: string; expiresAt: Date } {
  const kind = options.kind ?? 'invoices';
  const expires = Math.floor(now / 1000) + (options.ttlSeconds ?? LINK_TTL_SECONDS);
  const query = new URLSearchParams({ expires: String(expires), signature: linkSignature(env.BETTER_AUTH_SECRET, kind, id, expires) });
  return { url: `${env.API_PUBLIC_URL.replace(/\/$/, '')}/v1/${kind}/${id}.pdf?${query}`, expiresAt: new Date(expires * 1000) };
}

export function verifyInvoiceLink(env: Env, id: string, expires: string, signature: string, now = Date.now(), kind: DocumentKind = 'invoices'): boolean {
  const at = Number(expires);
  if (!Number.isFinite(at) || at * 1000 < now) return false;
  return safeEqual(linkSignature(env.BETTER_AUTH_SECRET, kind, id, at), signature);
}

export async function issueCreditNote(db: Database, env: Env, logger: Logger, orderId: string): Promise<typeof creditNote.$inferSelect | null> {
  const [existing] = await db.select().from(creditNote).where(eq(creditNote.orderId, orderId));
  if (existing) return existing;
  const [original] = await db.select().from(invoice).where(eq(invoice.orderId, orderId));
  if (!original) return null;
  const issuedAt = new Date();
  const year = financialYear(issuedAt);
  return db.transaction(async (tx) => {
    const [counter] = await tx
      .insert(invoiceCounter)
      .values({ financialYear: `CN-${year}`, last: 1 })
      .onConflictDoUpdate({ target: invoiceCounter.financialYear, set: { last: sql`${invoiceCounter.last} + 1` } })
      .returning();
    const number = `${env.INVOICE_PREFIX}/CN/${year}/${String(counter?.last ?? 1).padStart(6, '0')}`;
    const data: InvoiceData = { ...(original.data as InvoiceData), number, kind: 'credit_note', againstInvoice: original.number, issuedAt: issuedAt.toISOString() };
    const [stored] = await tx.insert(creditNote).values({ orderId, invoiceId: original.id, number, data, issuedAt }).returning();
    logger.info({ orderId, number, againstInvoice: original.number }, 'credit note issued');
    return stored ?? null;
  });
}
