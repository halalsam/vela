import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { dailyUsageSchema } from '@vela/api';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { requireUser } from '../auth/middleware';
import { device, esim, liveActivity } from '../db/schema';
import { notFound } from '../lib/errors';
import { dailyUsage } from '../modules/esims/usage';
import type { AppEnv } from '../types';

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const failure = (description: string) => ({ description, content: { 'application/json': { schema: errorSchema } } });
const done = { description: 'Done' };
const signedIn = { security: [{ bearer: [] }], middleware: requireUser };
const body = <T extends z.ZodType>(schema: T) => ({ body: { content: { 'application/json': { schema } } } });
const token = z.string().min(8).max(512);
const locale = z.string().min(2).max(16).default('en');
const iccidParam = z.object({ iccid: z.string().regex(/^\d{19,20}$/) });

const registerDevice = createRoute({
  method: 'post',
  path: '/v1/devices',
  tags: ['notifications'],
  ...signedIn,
  request: body(z.object({ platform: z.enum(['ios', 'android']), push_token: token, locale })),
  responses: { 204: done, 401: failure('Not signed in') },
});

const removeDevice = createRoute({
  method: 'delete',
  path: '/v1/devices',
  tags: ['notifications'],
  ...signedIn,
  request: body(z.object({ push_token: token })),
  responses: { 204: done, 401: failure('Not signed in') },
});

const startActivity = createRoute({
  method: 'post',
  path: '/v1/esims/{iccid}/live-activity',
  tags: ['notifications'],
  ...signedIn,
  request: { params: iccidParam, ...body(z.object({ push_token: token, locale, device_token: token.optional() })) },
  responses: { 204: done, 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

const endActivity = createRoute({
  method: 'delete',
  path: '/v1/esims/{iccid}/live-activity',
  tags: ['notifications'],
  ...signedIn,
  request: { params: iccidParam },
  responses: { 204: done, 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

const dailyRoute = createRoute({
  method: 'get',
  path: '/v1/esims/{iccid}/usage/daily',
  tags: ['esims'],
  ...signedIn,
  request: { params: iccidParam },
  responses: {
    200: { description: 'Data used per day for the last 7 days, oldest first', content: { 'application/json': { schema: z.array(dailyUsageSchema) } } },
    401: failure('Not signed in'),
    404: failure('eSIM not found'),
  },
});

export const deviceRoutes = new OpenAPIHono<AppEnv>()
  .openapi(registerDevice, async (c) => {
    const input = c.req.valid('json');
    await c.var.deps.db
      .insert(device)
      .values({ userId: c.var.user.id, platform: input.platform, pushToken: input.push_token, locale: input.locale })
      .onConflictDoUpdate({
        target: device.pushToken,
        set: { userId: c.var.user.id, platform: input.platform, locale: input.locale, lastSeenAt: sql`now()`, updatedAt: sql`now()` },
      });
    return c.body(null, 204);
  })
  .openapi(removeDevice, async (c) => {
    const { push_token } = c.req.valid('json');
    await c.var.deps.db.delete(device).where(and(eq(device.userId, c.var.user.id), eq(device.pushToken, push_token)));
    return c.body(null, 204);
  })
  .openapi(startActivity, async (c) => {
    const { db } = c.var.deps;
    const input = c.req.valid('json');
    const [owned] = await db
      .select({ id: esim.id })
      .from(esim)
      .where(and(eq(esim.userId, c.var.user.id), eq(esim.iccid, c.req.valid('param').iccid)));
    if (!owned) throw notFound('eSIM');
    const [linked] = input.device_token
      ? await db.select({ id: device.id }).from(device).where(and(eq(device.userId, c.var.user.id), eq(device.pushToken, input.device_token)))
      : [];
    await db
      .insert(liveActivity)
      .values({ esimId: owned.id, userId: c.var.user.id, deviceId: linked?.id ?? null, locale: input.locale, pushToken: input.push_token })
      .onConflictDoUpdate({
        target: liveActivity.pushToken,
        set: { esimId: owned.id, userId: c.var.user.id, locale: input.locale, endedAt: null, updatedAt: sql`now()` },
      });
    return c.body(null, 204);
  })
  .openapi(endActivity, async (c) => {
    const { db } = c.var.deps;
    const [owned] = await db
      .select({ id: esim.id })
      .from(esim)
      .where(and(eq(esim.userId, c.var.user.id), eq(esim.iccid, c.req.valid('param').iccid)));
    if (!owned) throw notFound('eSIM');
    await db
      .update(liveActivity)
      .set({ endedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(liveActivity.esimId, owned.id), isNull(liveActivity.endedAt)));
    return c.body(null, 204);
  })
  .openapi(dailyRoute, async (c) => c.json(await dailyUsage(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid), 200));
