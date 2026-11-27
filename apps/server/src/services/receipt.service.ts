import { formatData, formatPrice } from '@vela/utils';
import QRCode from 'qrcode';
import { PHONE_EMAIL_DOMAIN } from '../auth/auth';
import type { Database } from '../db/client';
import type { Env } from '../env';
import type { EmailSender } from '../integrations/email';
import { decrypt } from '../lib/crypto';
import { fromMinor } from '../lib/money';
import type { Logger } from '../logger';
import * as esims from '../models/esim.model';
import * as invoices from '../models/invoice.model';
import * as orders from '../models/order.model';
import * as plans from '../models/plan.model';
import * as profiles from '../models/profile.model';
import { toLocale } from '../views/messages.view';
import { buildReceipt } from '../views/receipt.view';
import { invoiceLink } from './invoices.service';
import { placeNames } from './notify.service';

const INVOICE_LINK_DAYS = 30;

/** Emails the install details once per eSIM order, when the buyer has a real email address. */
export async function sendReceipt(deps: { db: Database; env: Env; logger: Logger; email: EmailSender }, orderId: string): Promise<boolean> {
  const { db, env } = deps;
  const row = await orders.findOrder(db, orderId);
  if (!row || row.kind !== 'esim' || !row.esimId) return false;
  const buyer = await profiles.findProfile(db, row.userId);
  const address = buyer?.email && !buyer.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? buyer.email : null;
  if (!address) return false;
  if (!(await esims.claimNotice(db, row.esimId, 'receipt_email'))) return false;
  const issued = await esims.findEsim(db, row.esimId);
  const planRow = await plans.findPlanRow(db, row.planId ?? '');
  const bill = await invoices.findInvoiceForOrder(db, orderId);
  if (!issued || !planRow) return false;
  const locale = toLocale(buyer?.language);
  const places = await placeNames(db, planRow.id);
  const lpa = decrypt(issued.lpaEnc, env.ENCRYPTION_KEY);
  const message = buildReceipt({
    locale,
    place: places[locale],
    planLabel: `${places[locale]} · ${formatData(planRow.dataMb)} · ${planRow.validityDays}d`,
    orderNumber: row.number,
    paid: formatPrice(fromMinor(row.totalMinor, row.currency), row.currency),
    lpa,
    smdp: issued.smdp,
    activationCode: decrypt(issued.activationCodeEnc, env.ENCRYPTION_KEY),
    invoiceUrl: bill ? invoiceLink(env, bill.id, Date.now(), { ttlSeconds: INVOICE_LINK_DAYS * 86_400 }).url : null,
  });
  const qr = await QRCode.toBuffer(lpa, { type: 'png', width: 480, margin: 2, errorCorrectionLevel: 'M' });
  await deps.email.send({
    to: address,
    ...message,
    attachments: [{ filename: `vela-esim-${row.number}.png`, content: qr.toString('base64') }],
    idempotencyKey: `receipt-${orderId}`,
  });
  deps.logger.info({ orderId }, 'receipt email sent');
  return true;
}
