import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { invoiceLinkSchema, supportChatSchema, supportChatSummarySchema, supportMessageSchema, supportRatingStatusSchema } from '@vela/api';
import * as invoices from '../controllers/invoices.controller';
import * as support from '../controllers/support.controller';
import type { AppEnv } from '../types';
import { failure, iccidParam, json, signedIn } from './openapi';

export const threadRoute = createRoute({
  method: 'get',
  path: '/v1/support/messages',
  tags: ['support'],
  ...signedIn,
  responses: { 200: json(z.array(supportMessageSchema), 'The support conversation, oldest first'), 401: failure('Not signed in') },
});

export const sendRoute = createRoute({
  method: 'post',
  path: '/v1/support/messages',
  tags: ['support'],
  ...signedIn,
  request: { body: { content: { 'application/json': { schema: z.object({ text: z.string().trim().min(1).max(2000) }) } } } },
  responses: { 200: json(z.array(supportMessageSchema), 'The conversation including the new message'), 401: failure('Not signed in') },
});

export const ratingStatusRoute = createRoute({
  method: 'get',
  path: '/v1/support/rating',
  tags: ['support'],
  ...signedIn,
  responses: { 200: json(supportRatingStatusSchema, 'Whether support resolved the chat and asks for a rating'), 401: failure('Not signed in') },
});

export const rateRoute = createRoute({
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

export const chatsRoute = createRoute({
  method: 'get',
  path: '/v1/support/chats',
  tags: ['support'],
  ...signedIn,
  responses: { 200: json(z.array(supportChatSummarySchema), 'The customer’s support chats, newest activity first'), 401: failure('Not signed in') },
});

export const startChatRoute = createRoute({
  method: 'post',
  path: '/v1/support/chats',
  tags: ['support'],
  ...signedIn,
  request: jsonBody(z.object({ text: messageText, iccid: iccidParam.nullable().default(null) })),
  responses: {
    201: json(supportChatSchema, 'The new chat with its first message'),
    401: failure('Not signed in'),
    422: failure('The eSIM is not the customer’s'),
  },
});

export const chatRoute = createRoute({
  method: 'get',
  path: '/v1/support/chats/{id}',
  tags: ['support'],
  ...signedIn,
  request: { params: chatParams },
  responses: { 200: json(supportChatSchema, 'One chat, oldest message first'), 401: failure('Not signed in'), 404: failure('No such chat') },
});

export const chatMessageRoute = createRoute({
  method: 'post',
  path: '/v1/support/chats/{id}/messages',
  tags: ['support'],
  ...signedIn,
  request: { params: chatParams, ...jsonBody(z.object({ text: messageText })) },
  responses: { 200: json(supportChatSchema, 'The chat including the new message'), 401: failure('Not signed in'), 404: failure('No such chat') },
});

export const chatRatingRoute = createRoute({
  method: 'post',
  path: '/v1/support/chats/{id}/rating',
  tags: ['support'],
  ...signedIn,
  request: { params: chatParams, ...jsonBody(ratingBody) },
  responses: { 204: { description: 'Rating saved (ignored when none was asked for)' }, 401: failure('Not signed in'), 404: failure('No such chat') },
});

export const invoiceRoute = createRoute({
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

export const supportRoutes = new OpenAPIHono<AppEnv>()
  .openapi(threadRoute, support.thread)
  .openapi(sendRoute, support.send)
  .openapi(ratingStatusRoute, support.ratingStatus)
  .openapi(rateRoute, support.rate)
  .openapi(chatsRoute, support.listChats)
  .openapi(startChatRoute, support.startChat)
  .openapi(chatRoute, support.getChat)
  .openapi(chatMessageRoute, support.replyToChat)
  .openapi(chatRatingRoute, support.rateChat)
  .openapi(invoiceRoute, invoices.invoiceLink)
  .get('/v1/:kind{invoices|credit-notes}/:file', invoices.downloadDocument);
