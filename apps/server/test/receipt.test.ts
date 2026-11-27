import type { Checkout } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profile, user } from '../src/db/schema';
import { memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/db/seed';
import { syncCatalog } from '../src/services/catalogSync.service';
import { createMockProvider } from '../src/integrations/esims/mock';
import { createMemoryEmail, createResend } from '../src/integrations/email';
import { createMemoryPush } from '../src/integrations/push';
import { sendReceipt } from '../src/services/receipt.service';
import { buildReceipt } from '../src/views/receipt.view';
import { provisionOrder } from '../src/services/fulfilment.service';
import { createMockPayments, MOCK_SIGNATURE } from '../src/integrations/payments/mock';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv } from './helpers';

const sample = {
  locale: 'en' as const,
  place: 'Japan <Tokyo>',
  planLabel: 'Japan · 10 GB · 15d',
  orderNumber: 'VL-K7Q20011',
  paid: '₹1,199',
  lpa: 'LPA:1$smdp.example.com$K2-ABC',
  smdp: 'smdp.example.com',
  activationCode: 'K2-ABC',
  invoiceUrl: 'https://api.example.com/v1/invoices/x.pdf?expires=1&signature=s',
};

describe('receipt content', () => {
  it('has the install link, manual codes and invoice, with text escaped', () => {
    const message = buildReceipt(sample);
    expect(message.subject).toBe('Your Japan <Tokyo> eSIM is ready · VL-K7Q20011');
    expect(message.html).toContain('Japan &lt;Tokyo&gt;');
    expect(message.html).toContain('esim_qrcode_provisioning?carddata=LPA%3A1%24smdp.example.com%24K2-ABC');
    expect(message.text).toContain('Activation code: K2-ABC');
    expect(message.text).toContain(sample.invoiceUrl);
  });

  it('is written in Arabic, right to left, for Arabic customers', () => {
    const message = buildReceipt({ ...sample, locale: 'ar', place: 'اليابان', invoiceUrl: null });
    expect(message.subject).toBe('شريحة اليابان جاهزة · VL-K7Q20011');
    expect(message.html).toContain('dir="rtl"');
    expect(message.html).not.toContain('invoices');
  });

  it('sends through Resend with an idempotency key', async () => {
    const calls: { headers: Headers; body: Record<string, unknown> }[] = [];
    const resend = createResend({
      apiKey: 're_test',
      from: 'vela <receipts@vela.example>',
      fetch: (async (_url: string, init?: RequestInit) => {
        calls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        return Response.json({ id: 'email_1' });
      }) as typeof fetch,
    });
    await resend.send({ to: 'a@example.com', subject: 's', html: '<p>h</p>', text: 't', idempotencyKey: 'receipt-1', attachments: [{ filename: 'qr.png', content: 'AAA' }] });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer re_test');
    expect(calls[0]?.headers.get('idempotency-key')).toBe('receipt-1');
    expect(calls[0]?.body).toMatchObject({ from: 'vela <receipts@vela.example>', to: ['a@example.com'], attachments: [{ filename: 'qr.png' }] });
  });
});

describe('sending the receipt', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>['db'];
  let close: () => Promise<void>;
  let harness: ReturnType<typeof createTestApp>;
  const provider = createMockProvider();

  beforeAll(async () => {
    const test = await createTestDb();
    db = test.db;
    close = () => test.client.close();
    await seedReferenceData(db, { sampleContent: true });
    await syncCatalog(db, provider, { marginPercent: 40, logger: silentLogger });
    harness = createTestApp(db);
  });

  afterAll(async () => {
    await close();
  });

  async function buy(phone: string, key: string, emailAddress: string | null) {
    const token = await signInWithPhone(harness, phone);
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
    await db.update(profile).set({ email: emailAddress, language: 'ar' }).where(eq(profile.userId, row?.id ?? ''));
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = (await (
      await harness.app.request('/v1/orders', { method: 'POST', headers: { ...headers, 'idempotency-key': key }, body: JSON.stringify({ plan_id: 'jp-10gb-15d' }) })
    ).json()) as Checkout;
    await harness.app.request(`/v1/orders/${created.order.order_id}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payment_id: `pay_${key}`, signature: MOCK_SIGNATURE }),
    });
    const email = createMemoryEmail();
    await provisionOrder(
      { db, env: testEnv, logger: silentLogger, provider, payments: createMockPayments(), queue: memoryQueue(), push: createMemoryPush(), email },
      created.order.order_id,
      { finalAttempt: false },
    );
    return { email, orderId: created.order.order_id };
  }

  it('emails the receipt once, in the customer’s language, with the QR code and invoice link', async () => {
    const { email, orderId } = await buy('+919855500001', 'receipt-0001', 'asha@example.com');
    expect(email.sent).toHaveLength(1);
    const [message] = email.sent;
    expect(message).toMatchObject({ to: 'asha@example.com', idempotencyKey: `receipt-${orderId}` });
    expect(message?.subject).toContain('اليابان');
    expect(message?.text).toContain('/v1/invoices/');
    expect(Buffer.from(message?.attachments?.[0]?.content ?? '', 'base64').subarray(1, 4).toString()).toBe('PNG');
    expect(await sendReceipt({ db, env: testEnv, logger: silentLogger, email }, orderId)).toBe(false);
    expect(email.sent).toHaveLength(1);
  });

  it('skips customers who only signed in with a phone number', async () => {
    const { email } = await buy('+919855500002', 'receipt-0002', null);
    expect(email.sent).toEqual([]);
  });
});
