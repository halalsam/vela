import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { profileSchema } from '@vela/api';
import { requireUser } from '../auth/middleware';
import * as account from '../controllers/account.controller';
import type { AppEnv } from '../types';
import { failure } from './openapi';

const unauthorized = failure('Not signed in');

export const getMe = createRoute({
  method: 'get',
  path: '/v1/me',
  tags: ['account'],
  security: [{ bearer: [] }],
  middleware: [requireUser] as const,
  responses: {
    200: { description: 'The signed-in traveller', content: { 'application/json': { schema: profileSchema } } },
    401: unauthorized,
  },
});

export const deleteMe = createRoute({
  method: 'delete',
  path: '/v1/me',
  tags: ['account'],
  security: [{ bearer: [] }],
  middleware: [requireUser] as const,
  responses: {
    204: { description: 'Account deleted. Orders and invoices are kept for tax records without personal data.' },
    401: unauthorized,
  },
});

export const meRoutes = new OpenAPIHono<AppEnv>().openapi(getMe, account.getMe).openapi(deleteMe, account.deleteMe);
