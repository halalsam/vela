import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { invoiceLinkSchema, supportChatSchema, supportChatSummarySchema, supportMessageSchema, supportRatingStatusSchema } from '@vela/api';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '../auth/middleware';
import { creditNote, invoice, order } from '../db/schema';
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

const ratingStatusRoute = createRoute({
  method: 'get',
  path: '/v1/support/rating',
  tags: ['support'],
  ...signedIn,
  responses: { 200: json(supportRatingStatusSchema, 'Whether support resolved the chat and asks for a rating'), 401: failure('Not signed in') },
});

const rateRoute = createRoute({
  method: 'post',
  path: '/v1/support/rating',
  tags: ['support'],
  ...signedIn,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).nullable().default(null) }),
        },
      },
    },
  },
  responses: { 204: { description: 'Rating saved (ignored when none was asked for)' }, 401: failure('Not signed in') },
});

const messageText = z.string().trim().min(1).max(2000);
const ratingBody = z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).nullable().default(null) });
const chatParams = z.object({ id: z.string() });
const jsonBody = <T extends z.ZodType>(schema: T) => ({ body: { content: { 'application/json': { schema } } } });

const chatsRoute = createRoute({
  method: 'get',
  path: '/v1/support/chats',
  tags: ['support'],
  ...signedIn,
  responses: { 200: json(z.array(supportChatSummarySchema), 'The customer’s support chats, newest activity first'), 401: failure('Not signed in') },
});

const startChatRoute = createRoute({
  method: 'post',
  path: '/v1/support/chats',
  tags: ['support'],
  ...signedIn,
  request: jsonBody(z.object({ text: messageText, iccid: z.string().regex(/^\d{19,20}$/).nullable().default(null) })),
  responses: {
    201: json(supportChatSchema, 'The new chat with its first message'),
    401: failure('Not signed in'),
    422: failure('The eSIM is not the customer’s'),
  },
});

const chatRoute = createRoute({
  method: 'get',
  path: '/v1/support/chats/{id}',
  tags: ['support'],
  ...signedIn,
  request: { params: chatParams },
  responses: { 200: json(supportChatSchema, 'One chat, oldest message first'), 401: failure('Not signed in'), 404: failure('No such chat') },
});

const chatMessageRoute = createRoute({
  method: 'post',
  path: '/v1/support/chats/{id}/messages',
  tags: ['support'],
  ...signedIn,
  request: { params: chatParams, ...jsonBody(z.object({ text: messageText })) },
  responses: { 200: json(supportChatSchema, 'The chat including the new message'), 401: failure('Not signed in'), 404: failure('No such chat') },
});

const chatRatingRoute = createRoute({
  method: 'post',
  path: '/v1/support/chats/{id}/rating',
  tags: ['support'],
  ...signedIn,
  request: { params: chatParams, ...jsonBody(ratingBody) },
  responses: { 204: { description: 'Rating saved (ignored when none was asked for)' }, 401: failure('Not signed in'), 404: failure('No such chat') },
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
  .openapi(ratingStatusRoute, async (c) => c.json({ asked: await c.var.deps.support.ratingAsked(await supportFor(c)) }, 200))
  .openapi(rateRoute, async (c) => {
    const body = c.req.valid('json');
    await c.var.deps.support.rate(await supportFor(c), body.score, body.comment || null);
    return c.body(null, 204);
  })
  .openapi(chatsRoute, async (c) => c.json(await c.var.deps.support.chats(await supportFor(c)), 200))
  .openapi(startChatRoute, async (c) => {
    const body = c.req.valid('json');
    return c.json(await c.var.deps.support.start(await supportFor(c), body.text, body.iccid), 201);
  })
  .openapi(chatRoute, async (c) => c.json(await c.var.deps.support.chat(await supportFor(c), c.req.valid('param').id), 200))
  .openapi(chatMessageRoute, async (c) =>
    c.json(await c.var.deps.support.reply(await supportFor(c), c.req.valid('param').id, c.req.valid('json').text), 200),
  )
  .openapi(chatRatingRoute, async (c) => {
    const body = c.req.valid('json');
    await c.var.deps.support.rateChat(await supportFor(c), c.req.valid('param').id, body.score, body.comment || null);
    return c.body(null, 204);
  })
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
  .get('/v1/:kind{invoices|credit-notes}/:file', async (c) => {
    const kind = c.req.param('kind') as 'invoices' | 'credit-notes';
    const id = c.req.param('file').replace(/\.pdf$/, '');
    const expires = c.req.query('expires') ?? '';
    const signature = c.req.query('signature') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyInvoiceLink(c.var.deps.env, id, expires, signature, Date.now(), kind)) {
      throw new HttpError(403, 'link_expired', 'This invoice link has expired. Open it again from the app.');
    }
    const [row] =
      kind === 'invoices'
        ? await c.var.deps.db.select().from(invoice).where(eq(invoice.id, id))
        : await c.var.deps.db.select().from(creditNote).where(eq(creditNote.id, id));
    if (!row) throw notFound('Invoice');
    const pdf = await renderInvoicePdf(row.data as InvoiceData);
    return c.body(new Uint8Array(pdf), 200, {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${row.number.replace(/\//g, '-')}.pdf"`,
      'cache-control': 'private, no-store',
    });
  });
