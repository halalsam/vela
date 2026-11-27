import type { Env } from '../env';
import { fromMinor, type CurrencyCode } from '../lib/money';
import type { OrderRow } from '../models/order.model';
import type { PlanRow, TopUpPackRow } from '../models/plan.model';
import type { ProfileRow } from '../models/profile.model';

/** Everything printed on a GST invoice or credit note; stored as JSON with the document. */
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

function describe(row: PlanRow | null, pack: TopUpPackRow | null, kind: string): string {
  const size = (mb: number) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`);
  const scope = row ? (row.type === 'country' ? row.countryCodes.join(', ') : (row.regionId ?? row.type).toUpperCase()) : '';
  if (kind === 'top_up' && pack) return `eSIM data top-up, ${size(pack.dataMb)}${pack.extraDays ? ` and ${pack.extraDays} days` : ''} (${scope})`;
  return row ? `eSIM data plan, ${size(row.dataMb)} for ${row.validityDays} days (${scope})` : 'eSIM data plan';
}

export function invoiceData(input: {
  env: Env;
  number: string;
  issuedAt: Date;
  order: OrderRow;
  plan: PlanRow | null;
  pack: TopUpPackRow | null;
  buyer: ProfileRow | null;
}): InvoiceData {
  const { env, order: row } = input;
  const state = env.SELLER_STATE || 'Not set';
  const half = Math.floor(row.taxMinor / 2);
  const money = (minor: number) => fromMinor(minor, row.currency);
  return {
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    orderNumber: row.number,
    seller: { name: env.SELLER_NAME, gstin: env.SELLER_GSTIN ?? null, address: env.SELLER_ADDRESS, state },
    buyer: { name: input.buyer?.name ?? 'Traveller', email: input.buyer?.email ?? null, phone: input.buyer?.phone ?? null },
    placeOfSupply: state,
    sac: env.INVOICE_SAC,
    currency: row.currency,
    description: describe(input.plan, input.pack, row.kind),
    subtotal: money(row.subtotalMinor),
    discount: money(row.discountMinor),
    credit: money(row.creditMinor),
    taxable: money(row.totalMinor - row.taxMinor),
    cgst: money(half),
    sgst: money(row.taxMinor - half),
    igst: 0,
    total: money(row.totalMinor),
  };
}
