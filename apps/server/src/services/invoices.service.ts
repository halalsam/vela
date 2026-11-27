import { createHmac } from 'node:crypto';
import type { Database } from '../db/client';
import type { Env } from '../env';
import { safeEqual } from '../integrations/payments/razorpay';
import { HttpError, notFound } from '../lib/errors';
import type { Logger } from '../logger';
import * as invoices from '../models/invoice.model';
import * as orders from '../models/order.model';
import * as plans from '../models/plan.model';
import * as profiles from '../models/profile.model';
import { invoiceData, type InvoiceData } from '../views/invoice.view';
import { renderInvoicePdf } from '../views/invoicePdf.view';

const IST_OFFSET_MS = 330 * 60_000;
const LINK_TTL_SECONDS = 15 * 60;

/** The Indian financial year (April to March, in IST) as "2026-27". */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function invoiceNumber(prefix: string, year: string, sequence: number): string {
  return `${prefix}/${year}/${String(sequence).padStart(6, '0')}`;
}

/** Issues the GST invoice for a fulfilled INR order, once. */
export async function issueInvoice(db: Database, env: Env, logger: Logger, orderId: string): Promise<invoices.InvoiceRow | null> {
  const existing = await invoices.findInvoiceForOrder(db, orderId);
  if (existing) return existing;
  const row = await orders.findOrder(db, orderId);
  if (!row || row.status !== 'fulfilled') return null;
  if (row.currency !== 'INR') {
    logger.info({ orderId, currency: row.currency }, 'no GST invoice for a non-INR order');
    return null;
  }
  const planRow = row.planId ? await plans.findPlanRow(db, row.planId) : null;
  const pack = row.topUpPackId ? await plans.findTopUpPack(db, row.topUpPackId) : null;
  const buyer = await profiles.findProfile(db, row.userId);
  const issuedAt = new Date();
  const year = financialYear(issuedAt);

  return db.transaction(async (tx) => {
    const number = invoiceNumber(env.INVOICE_PREFIX, year, await invoices.nextSequence(tx, year));
    const data = invoiceData({ env, number, issuedAt, order: row, plan: planRow, pack, buyer });
    const stored = await invoices.insertInvoice(tx, { orderId, number, gstin: data.seller.gstin, placeOfSupply: data.placeOfSupply, data, issuedAt });
    logger.info({ orderId, number }, 'invoice issued');
    return stored;
  });
}

export type DocumentKind = 'invoices' | 'credit-notes';

function linkSignature(secret: string, kind: DocumentKind, id: string, expires: number): string {
  const scope = kind === 'invoices' ? 'invoice' : 'credit-note';
  return createHmac('sha256', secret).update(`${scope}:${id}:${expires}`).digest('base64url');
}

/** A signed, expiring download link for an invoice or credit note PDF. */
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

/** Issues a credit note against the order's invoice, once (nothing when there was no invoice). */
export async function issueCreditNote(db: Database, env: Env, logger: Logger, orderId: string): Promise<invoices.CreditNoteRow | null> {
  const existing = await invoices.findCreditNoteForOrder(db, orderId);
  if (existing) return existing;
  const original = await invoices.findInvoiceForOrder(db, orderId);
  if (!original) return null;
  const issuedAt = new Date();
  const year = financialYear(issuedAt);
  return db.transaction(async (tx) => {
    const sequence = await invoices.nextSequence(tx, `CN-${year}`);
    const number = `${env.INVOICE_PREFIX}/CN/${year}/${String(sequence).padStart(6, '0')}`;
    const data: InvoiceData = { ...(original.data as InvoiceData), number, kind: 'credit_note', againstInvoice: original.number, issuedAt: issuedAt.toISOString() };
    const stored = await invoices.insertCreditNote(tx, { orderId, invoiceId: original.id, number, data, issuedAt });
    logger.info({ orderId, number, againstInvoice: original.number }, 'credit note issued');
    return stored;
  });
}

/** A fresh download link for the customer's own order invoice (issuing it if it is due). */
export async function invoiceLinkForCustomer(db: Database, env: Env, logger: Logger, userId: string, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw notFound('Order');
  if (!(await orders.findUserOrder(db, userId, orderId))) throw notFound('Order');
  const issued = await issueInvoice(db, env, logger, orderId);
  if (!issued) throw notFound('Invoice');
  const link = invoiceLink(env, issued.id);
  return { number: issued.number, url: link.url, expiresAt: link.expiresAt };
}

/** The PDF behind a signed invoice or credit-note link. */
export async function documentPdf(
  db: Database,
  env: Env,
  kind: DocumentKind,
  id: string,
  link: { expires: string; signature: string },
): Promise<{ filename: string; pdf: Buffer }> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyInvoiceLink(env, id, link.expires, link.signature, Date.now(), kind)) {
    throw new HttpError(403, 'link_expired', 'This invoice link has expired. Open it again from the app.');
  }
  const row = kind === 'invoices' ? await invoices.findInvoice(db, id) : await invoices.findCreditNote(db, id);
  if (!row) throw notFound('Invoice');
  return { filename: `${row.number.replace(/\//g, '-')}.pdf`, pdf: await renderInvoicePdf(row.data as InvoiceData) };
}
