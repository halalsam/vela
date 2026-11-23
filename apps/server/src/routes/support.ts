import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { invoiceLinkSchema, supportMessageSchema } from '@vela/api';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '../auth/middleware';
import { invoice, order } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { invoiceLink, issueInvoice, verifyInvoiceLink, type InvoiceData } from '../modules/invoices/invoice';
import { renderInvoicePdf } from '../modules/invoices/pdf';
import { supportUser } from '../modules/support/support';
import type { AppEnv } from '../types';

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const failure = (description: string) => ({ description, content: { 'application/json': { schema: errorSchema } } });
const json = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
const signedIn = { security: [{ bearer: [] }], middleware: requireUser };

const threadRoute = createRoute({
  method: 'get',
  path: '/v1/support/messages',
  tags: ['support'],
  ...signedIn,
  responses: { 200: json(z.array(supportMessageSchema), 'The support conversation, oldest first'), 401: failure('Not signed in') },
});

const sendRoute = createRoute({
  method: 'post',
  path: '/v1/support/messages',
  tags: ['support'],
  ...signedIn,
  request: { body: { content: { 'application/json': { schema: z.object({ text: z.string().trim().min(1).max(2000) }) } } } },
  responses: { 200: json(z.array(supportMessageSchema), 'The conversation including the new message'), 401: failure('Not signed in') },
});

const invoiceRoute = createRoute({
  method: 'get',
  path: '/v1/orders/{id}/invoice',
  tags: ['checkout'],
  ...signedIn,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: json(invoiceLinkSchema, 'A download link for the GST invoice, valid for 15 minutes'),
    401: failure('Not signed in'),
    404: failure('Order or invoice not found'),
  },
});

async function supportFor(c: { var: AppEnv['Variables'] }) {
  const user = c.var.user;
  return supportUser(c.var.deps.db, user.id, { name: user.name, email: null, phone: user.phoneNumber });
}

export const supportRoutes = new OpenAPIHono<AppEnv>()
  .openapi(threadRoute, async (c) => c.json(await c.var.deps.support.thread(await supportFor(c)), 200))
  .openapi(sendRoute, async (c) => c.json(await c.var.deps.support.send(await supportFor(c), c.req.valid('json').text), 200))
  .openapi(invoiceRoute, async (c) => {
    const { db, env } = c.var.deps;
    const id = c.req.valid('param').id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Order');
    const [owned] = await db.select({ id: order.id }).from(order).where(and(eq(order.id, id), eq(order.userId, c.var.user.id)));
    if (!owned) throw notFound('Order');
    const issued = await issueInvoice(db, env, c.var.logger, id);
    if (!issued) throw notFound('Invoice');
    const link = invoiceLink(env, issued.id);
    return c.json({ number: issued.number, url: link.url, expires_at: link.expiresAt.toISOString() }, 200);
  })
  .get('/v1/invoices/:file', async (c) => {
    const id = c.req.param('file').replace(/\.pdf$/, '');
    const expires = c.req.query('expires') ?? '';
    const signature = c.req.query('signature') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyInvoiceLink(c.var.deps.env, id, expires, signature)) {
      throw new HttpError(403, 'link_expired', 'This invoice link has expired. Open it again from the app.');
    }
    const [row] = await c.var.deps.db.select().from(invoice).where(eq(invoice.id, id));
    if (!row) throw notFound('Invoice');
    const pdf = await renderInvoicePdf(row.data as InvoiceData);
    return c.body(new Uint8Array(pdf), 200, {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${row.number.replace(/\//g, '-')}.pdf"`,
      'cache-control': 'private, no-store',
    });
  });
