import { formatData, formatPrice } from '@vela/utils';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Database } from '../../db/client';
import { esim, esimNotice, invoice, order, plan, profile } from '../../db/schema';
import type { Env } from '../../env';
import { decrypt } from '../../lib/crypto';
import { fromMinor } from '../../lib/money';
import type { Logger } from '../../logger';
import { invoiceLink } from '../invoices/invoice';
import type { EmailMessage, EmailSender } from './email';
import { toLocale, type Locale } from './messages';
import { placeNames } from './notify';
import { PHONE_EMAIL_DOMAIN } from '../../auth/auth';

const INVOICE_LINK_DAYS = 30;

const copy: Record<Locale, Record<string, string>> = {
  en: {
    subject: 'Your {place} eSIM is ready · {order}',
    heading: 'Your {place} eSIM is ready',
    plan: 'Plan',
    order: 'Order',
    paid: 'Paid',
    iphone: 'On iPhone (iOS 17.4 or later), tap to install',
    install: 'Install eSIM',
    qr: 'Or scan the attached QR code from another screen: Settings › Mobile › Add eSIM › Use QR code.',
    manual: 'Manual install',
    smdp: 'SM-DP+ address',
    code: 'Activation code',
    tip: 'Install it before you fly while you have Wi-Fi. The plan starts when you land and connect.',
    invoice: 'Download your GST invoice (link valid for 30 days)',
    footer: 'Questions? Reply in the vela app under Profile › Support chat.',
  },
  ar: {
    subject: 'شريحة {place} جاهزة · {order}',
    heading: 'شريحة {place} جاهزة',
    plan: 'الباقة',
    order: 'الطلب',
    paid: 'المبلغ المدفوع',
    iphone: 'على iPhone ‏(iOS 17.4 أو أحدث)، اضغط للتثبيت',
    install: 'تثبيت الشريحة',
    qr: 'أو امسح رمز QR المرفق من شاشة أخرى: الإعدادات › الخلوي › إضافة شريحة eSIM › استخدام رمز QR.',
    manual: 'التثبيت اليدوي',
    smdp: 'عنوان SM-DP+‎',
    code: 'رمز التفعيل',
    tip: 'ثبّتها قبل السفر وأنت متصل بشبكة Wi-Fi. تبدأ الباقة عند وصولك واتصالك.',
    invoice: 'تنزيل الفاتورة الضريبية (الرابط صالح 30 يومًا)',
    footer: 'لديك سؤال؟ راسلنا من تطبيق vela: الملف الشخصي › محادثة الدعم.',
  },
};

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

export type ReceiptInput = {
  locale: Locale;
  place: string;
  planLabel: string;
  orderNumber: string;
  paid: string;
  lpa: string;
  smdp: string;
  activationCode: string;
  invoiceUrl: string | null;
};

export function buildReceipt(input: ReceiptInput): Pick<EmailMessage, 'subject' | 'html' | 'text'> {
  const t = copy[input.locale];
  const values = { place: input.place, order: input.orderNumber };
  const installUrl = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(input.lpa)}`;
  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#666">${escape(label)}</td><td style="padding:6px 0;text-align:${dir === 'rtl' ? 'left' : 'right'}" dir="ltr">${escape(value)}</td></tr>`;
  const html = `<!doctype html><html lang="${input.locale}" dir="${dir}"><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:14px;letter-spacing:2px;color:#8a7650;margin:0 0 16px">VELA</p>
<h1 style="font-size:24px;margin:0 0 20px">${escape(fill(t.heading ?? '', values))}</h1>
<table style="width:100%;border-collapse:collapse;font-size:15px">${row(t.plan ?? '', input.planLabel)}${row(t.order ?? '', input.orderNumber)}${row(t.paid ?? '', input.paid)}</table>
<p style="margin:24px 0 8px;font-size:15px">${escape(t.iphone ?? '')}</p>
<p style="margin:0 0 20px"><a href="${escape(installUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${escape(t.install ?? '')}</a></p>
<p style="font-size:14px;color:#444">${escape(t.qr ?? '')}</p>
<h2 style="font-size:16px;margin:24px 0 8px">${escape(t.manual ?? '')}</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">${row(t.smdp ?? '', input.smdp)}${row(t.code ?? '', input.activationCode)}</table>
<p style="font-size:14px;color:#444;margin-top:20px">${escape(t.tip ?? '')}</p>
${input.invoiceUrl ? `<p style="font-size:14px;margin-top:20px"><a href="${escape(input.invoiceUrl)}" style="color:#8a7650">${escape(t.invoice ?? '')}</a></p>` : ''}
<p style="font-size:12px;color:#888;margin-top:32px">${escape(t.footer ?? '')}</p>
</div></body></html>`;
  const text = [
    fill(t.heading ?? '', values),
    '',
    `${t.plan}: ${input.planLabel}`,
    `${t.order}: ${input.orderNumber}`,
    `${t.paid}: ${input.paid}`,
    '',
    `${t.iphone}: ${installUrl}`,
    t.qr,
    '',
    `${t.smdp}: ${input.smdp}`,
    `${t.code}: ${input.activationCode}`,
    '',
    t.tip,
    ...(input.invoiceUrl ? ['', `${t.invoice}: ${input.invoiceUrl}`] : []),
    '',
    t.footer,
  ].join('\n');
  return { subject: fill(t.subject ?? '', values), html, text };
}

export async function sendReceipt(deps: { db: Database; env: Env; logger: Logger; email: EmailSender }, orderId: string): Promise<boolean> {
  const { db, env } = deps;
  const [row] = await db.select().from(order).where(eq(order.id, orderId));
  if (!row || row.kind !== 'esim' || !row.esimId) return false;
  const [buyer] = await db.select().from(profile).where(eq(profile.userId, row.userId));
  const address = buyer?.email && !buyer.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? buyer.email : null;
  if (!address) return false;
  const [claimed] = await db.insert(esimNotice).values({ esimId: row.esimId, kind: 'receipt_email' }).onConflictDoNothing().returning();
  if (!claimed) return false;
  const [issued] = await db.select().from(esim).where(eq(esim.id, row.esimId));
  const [planRow] = await db.select().from(plan).where(eq(plan.id, row.planId ?? ''));
  const [bill] = await db.select().from(invoice).where(eq(invoice.orderId, orderId));
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
