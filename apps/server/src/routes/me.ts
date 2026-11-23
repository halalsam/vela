import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { profileSchema } from '@vela/api';
import { eq } from 'drizzle-orm';
import { PHONE_EMAIL_DOMAIN } from '../auth/auth';
import { requireUser } from '../auth/middleware';
import { account, profile, user } from '../db/schema';
import type { AppEnv } from '../types';

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const unauthorized = { description: 'Not signed in', content: { 'application/json': { schema: errorSchema } } };

const getMe = createRoute({
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

const deleteMe = createRoute({
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

export const meRoutes = new OpenAPIHono<AppEnv>()
  .openapi(getMe, async (c) => {
    const { db } = c.var.deps;
    const current = c.var.user;
    const [row] = await db.select().from(profile).where(eq(profile.userId, current.id));
    const providers = await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, current.id));
    const provider = providers.some((item) => item.providerId === 'apple')
      ? 'apple'
      : providers.some((item) => item.providerId === 'google')
        ? 'google'
        : 'phone';
    const email = current.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? null : current.email;
    return c.json(
      {
        name: row?.name ?? (current.name === 'Traveller' ? '' : current.name),
        email: row?.email ?? email,
        phone: row?.phone ?? current.phoneNumber,
        provider,
      } as const,
      200,
    );
  })
  .openapi(deleteMe, async (c) => {
    await c.var.deps.db.delete(user).where(eq(user.id, c.var.user.id));
    c.var.logger.info({ userId: c.var.user.id }, 'account deleted');
    return c.body(null, 204);
  });
