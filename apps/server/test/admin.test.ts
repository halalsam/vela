import { createHmac } from 'node:crypto';
import type { Checkout, InvoiceLink, Rewards, SupportMessage } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, invoice, payment, profile, supportContact, user } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { memoryQueue } from '../src/jobs/queue';
import { seedReferenceData } from '../src/modules/catalog/seed';
import { syncCatalog } from '../src/modules/catalog/sync';
import { createMockProvider } from '../src/modules/esims/providers/mock';
import { financialYear, invoiceNumber, type InvoiceData } from '../src/modules/invoices/invoice';
import { createMemoryPush } from '../src/modules/notifications/push';
import { provisionOrder } from '../src/modules/orders/fulfil';
import { createMockPayments, MOCK_SIGNATURE } from '../src/modules/payments/mock';
import { createSupportDesk } from '../src/modules/support/support';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv, testKey } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let customer: string;
let staff: string;

const provider = createMockProvider();

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  await seedReferenceData(db, { sampleContent: true });
  await syncCatalog(db, provider, { marginPercent: 40, logger: silentLogger });
  harness = createTestApp(db);
  customer = await signInWithPhone(harness, '+919833300001');
  staff = await signInWithPhone(harness, '+919833300002');
});

afterAll(async () => {
  await close();
});

const headers = (bearer: string) => ({ authorization: `Bearer ${bearer}`, 'content-type': 'application/json' });
const call = (method: string, path: string, bearer: string, body?: unknown) =>
  harness.app.request(path, { method, headers: headers(bearer), body: body === undefined ? undefined : JSON.stringify(body) });

async function setRole(phone: string, role: 'customer' | 'support' | 'admin') {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
  await db.update(profile).set({ role }).where(eq(profile.userId, row?.id ?? ''));
  return row?.id ?? '';
}

async function buy(planId: string, key: string) {
  const response = await harness.app.request('/v1/orders', {
    method: 'POST',
    headers: { ...headers(customer), 'idempotency-key': key },
    body: JSON.stringify({ plan_id: planId }),
  });
  const { order } = (await response.json()) as Checkout;
  await call('POST', `/v1/orders/${order.order_id}/confirm`, customer, { payment_id: `pay_${key}`, signature: MOCK_SIGNATURE });
  await provisionOrder(
    { db, env: testEnv, logger: silentLogger, provider, payments: createMockPayments(), queue: memoryQueue(), push: createMemoryPush() },
    order.order_id,
    { finalAttempt: false },
  );
  return order;
}

describe('invoice numbers', () => {
  it('follow the Indian financial year in IST and count up from 1', () => {
    expect(financialYear(new Date('2026-03-31T18:29:00Z'))).toBe('2025-26');
    expect(financialYear(new Date('2026-03-31T18:31:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2027-01-15T00:00:00Z'))).toBe('2026-27');
    expect(invoiceNumber('VL', '2026-27', 123)).toBe('VL/2026-27/000123');
  });
});

describe('invoices', () => {
  let orderId = '';

  it('are issued when an order is fulfilled, numbered in sequence, with GST split into CGST and SGST', async () => {
    const first = await buy('jp-10gb-15d', 'invoice-buy-0001');
    const second = await buy('th-3gb-7d', 'invoice-buy-0002');
    orderId = first.order_id;
    const rows = await db.select().from(invoice);
    const year = financialYear(new Date());
    expect(rows.map((row) => row.number).sort()).toEqual([`VL/${year}/000001`, `VL/${year}/000002`]);
    const data = rows.find((row) => row.orderId === second.order_id)?.data as InvoiceData;
    expect(data).toMatchObject({ currency: 'INR', total: second.total, sac: '9984', orderNumber: second.number });
    expect(Math.round((data.cgst + data.sgst) * 100)).toBe(Math.round(second.tax * 100));
    expect(Math.round((data.taxable + data.cgst + data.sgst) * 100)).toBe(Math.round(data.total * 100));
  });

  it('download through a short-lived signed link, only for the owner', async () => {
    const link = (await (await call('GET', `/v1/orders/${orderId}/invoice`, customer)).json()) as InvoiceLink;
    expect(link.number).toMatch(/^VL\/\d{4}-\d{2}\/\d{6}$/);
    const path = new URL(link.url).pathname + new URL(link.url).search;
    const pdf = await harness.app.request(path);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    expect((await harness.app.request(path.replace(/signature=[^&]+/, 'signature=forged'))).status).toBe(403);
    expect((await harness.app.request(path.replace(/expires=\d+/, 'expires=1000'))).status).toBe(403);
    expect((await call('GET', `/v1/orders/${orderId}/invoice`, staff)).status).toBe(404);
  });
});

describe('admin', () => {
  it('is closed to customers and opens by role', async () => {
    expect((await call('GET', '/v1/admin/orders', staff)).status).toBe(403);
    expect((await harness.app.request('/v1/admin/orders')).status).toBe(401);
    await setRole('+919833300002', 'support');
    expect(await (await call('GET', '/v1/admin/me', staff)).json()).toMatchObject({ role: 'support' });
    const orders = (await (await call('GET', '/v1/admin/orders?q=%2B91983330000', staff)).json()) as { number: string; invoice_number: string }[];
    expect(orders).toHaveLength(2);
    expect(orders[0]?.invoice_number).toMatch(/^VL\//);
    const one = (await (await call('GET', `/v1/admin/orders?q=${orders[1]?.number}`, staff)).json()) as unknown[];
    expect(one).toHaveLength(1);
  });

  it('lets support look but only admins refund, and records who did it', async () => {
    const [target] = (await (await call('GET', '/v1/admin/orders?status=fulfilled', staff)).json()) as { order_id: string }[];
    const id = target?.order_id ?? '';
    const detail = (await (await call('GET', `/v1/admin/orders/${id}`, staff)).json()) as { payments: unknown[]; esim: unknown; invoice: { url: string } };
    expect(detail.payments).toHaveLength(1);
    expect(detail.esim).toBeTruthy();
    expect(detail.invoice.url).toContain('/v1/invoices/');

    expect((await call('POST', `/v1/admin/orders/${id}/refund`, staff, { reason: 'customer asked' })).status).toBe(403);
    const adminId = await setRole('+919833300002', 'admin');
    const refunded = await call('POST', `/v1/admin/orders/${id}/refund`, staff, { reason: 'customer asked' });
    expect(refunded.status).toBe(200);
    expect(await refunded.json()).toMatchObject({ status: 'refunded', failure_reason: 'Refunded by staff: customer asked' });
    const [paid] = await db.select().from(payment).where(eq(payment.orderId, id));
    expect(paid?.status).toBe('refunded');
    const [entry] = await db.select().from(auditLog).where(eq(auditLog.target, `order:${id}`));
    expect(entry).toMatchObject({ actorId: adminId, action: 'order.refund' });
    const after = (await (await call('GET', `/v1/admin/orders/${id}`, staff)).json()) as { credit_note: { number: string; url: string }; esim: { status: string } };
    expect(after.credit_note.number).toMatch(/^VL\/CN\/\d{4}-\d{2}\/000001$/);
    expect(after.esim.status).toBe('expired');
    expect(entry?.data).toMatchObject({ supplierCancelled: true, creditNote: after.credit_note.number });
    const note = await harness.app.request(new URL(after.credit_note.url).pathname + new URL(after.credit_note.url).search);
    expect(note.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await note.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    const tampered = new URL(after.credit_note.url).pathname.replace('/credit-notes/', '/invoices/') + new URL(after.credit_note.url).search;
    expect((await harness.app.request(tampered)).status).toBe(403);
    expect((await call('POST', `/v1/admin/orders/${id}/refund`, staff, { reason: 'again' })).status).toBe(409);
    expect((await call('POST', `/v1/admin/orders/${id}/refund`, staff, { reason: '' })).status).toBe(400);
  });

  it('creates, limits and ends coupons', async () => {
    const created = await call('POST', '/v1/admin/coupons', staff, { code: 'monsoon100', kind: 'amount', value: 100, currency: 'INR', max_redemptions: 50 });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ code: 'MONSOON100', value: 100, currency: 'INR', max_redemptions: 50, redemptions: 0 });
    const valid = await call('POST', '/v1/coupons/validate', customer, { code: 'MONSOON100' });
    expect(await valid.json()).toMatchObject({ discount_amount: 100 });

    expect((await call('POST', '/v1/admin/coupons', staff, { code: 'MONSOON100', kind: 'percent', value: 10 })).status).toBe(409);
    expect((await call('POST', '/v1/admin/coupons', staff, { code: 'TOOBIG', kind: 'percent', value: 150 })).status).toBe(422);
    const rewards = (await (await call('GET', '/v1/rewards', customer)).json()) as Rewards;
    expect((await call('POST', '/v1/admin/coupons', staff, { code: rewards.code, kind: 'percent', value: 10 })).status).toBe(409);

    const ended = await call('PATCH', '/v1/admin/coupons/monsoon100', staff, { ends_at: new Date(Date.now() - 1000).toISOString() });
    expect(ended.status).toBe(200);
    expect((await call('POST', '/v1/coupons/validate', customer, { code: 'MONSOON100' })).status).toBe(422);
    const list = (await (await call('GET', '/v1/admin/coupons', staff)).json()) as { code: string }[];
    expect(list.map((item) => item.code)).toContain('GULF20');
  });

  it('grants goodwill credit to a customer', async () => {
    const [target] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, '+919833300001'));
    expect((await call('POST', `/v1/admin/users/${target?.id}/credit`, staff, { amount: 250, currency: 'INR', reason: 'slow install' })).status).toBe(204);
    expect(((await (await call('GET', '/v1/rewards', customer)).json()) as Rewards).balance).toBe(250);
    const audit = (await (await call('GET', `/v1/admin/audit?target=user:${target?.id}`, staff)).json()) as { action: string }[];
    expect(audit.map((item) => item.action)).toEqual(['credit.grant']);
  });
});

describe('support', () => {
  it('keeps a local thread when Chatwoot is not set up', async () => {
    const first = (await (await call('GET', '/v1/support/messages', customer)).json()) as SupportMessage[];
    expect(first).toEqual([expect.objectContaining({ id: 'welcome', from: 'agent' })]);
    const after = (await (await call('POST', '/v1/support/messages', customer, { text: 'My eSIM won’t install' })).json()) as SupportMessage[];
    expect(after.map((item) => [item.from, item.text]).slice(1)).toEqual([['user', 'My eSIM won’t install']]);
    expect((await call('POST', '/v1/support/messages', customer, { text: '   ' })).status).toBe(400);
  });

  it('talks to Chatwoot with a verified contact, one conversation per traveller', async () => {
    const requests: { method: string; url: string; body: unknown }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      requests.push({ method: init?.method ?? 'GET', url, body });
      if (url.endsWith('/contacts')) return Response.json({ source_id: 'src-1' });
      if (url.endsWith('/conversations') && init?.method === 'POST') return Response.json({ id: 42 });
      if (url.endsWith('/messages') && init?.method === 'POST') return Response.json({ id: 9 });
      return Response.json([
        { id: 1, content: 'Hello', message_type: 0, created_at: 1_800_000_000 },
        { id: 2, content: 'Hi! Try restarting your phone.', message_type: 1, created_at: 1_800_000_060 },
        { id: 3, content: 'Conversation assigned', message_type: 2, created_at: 1_800_000_061 },
      ]);
    }) as typeof fetch;
    const env = loadEnv({
      DATABASE_URL: 'postgres://x',
      ENCRYPTION_KEY: testKey,
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      CHATWOOT_URL: 'https://chat.example.com',
      CHATWOOT_INBOX_IDENTIFIER: 'inbox-abc',
      CHATWOOT_HMAC_TOKEN: 'hmac-secret',
    });
    const desk = createSupportDesk(env, db, silentLogger, fake);
    const traveller = { id: 'user-chatwoot-1', name: 'Asha', email: null, phone: '+919800000000', language: 'en' };

    const thread = await desk.thread(traveller);
    expect(thread.map((item) => [item.from, item.text])).toEqual([
      ['agent', expect.stringContaining('vela support')],
      ['user', 'Hello'],
      ['agent', 'Hi! Try restarting your phone.'],
    ]);
    await desk.send(traveller, 'Thanks');
    const contacts = requests.filter((item) => item.url.endsWith('/contacts'));
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.body).toMatchObject({
      identifier: 'user-chatwoot-1',
      identifier_hash: createHmac('sha256', 'hmac-secret').update('user-chatwoot-1').digest('hex'),
      phone_number: '+919800000000',
    });
    expect(requests.filter((item) => item.url.endsWith('/conversations') && item.method === 'POST')).toHaveLength(1);
    expect(requests.find((item) => item.method === 'POST' && item.url.endsWith('/conversations/42/messages'))?.body).toEqual({ content: 'Thanks' });
    const [stored] = await db.select().from(supportContact).where(eq(supportContact.userId, 'user-chatwoot-1'));
    expect(stored).toMatchObject({ sourceId: 'src-1', conversationId: 42 });
  });
});

describe('seller settings', () => {
  it('refuse production without the GSTIN, address and state', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://x', ENCRYPTION_KEY: testKey, BETTER_AUTH_SECRET: 'x'.repeat(32), APP_ENV: 'production' })).toThrow(
      /production invoices need the seller GSTIN/,
    );
  });
});
