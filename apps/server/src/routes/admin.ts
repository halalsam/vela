import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { requireUser } from '../auth/middleware';
import { HttpError } from '../lib/errors';
import {
  createCoupon,
  grantCredit,
  listCoupons,
  listOrders,
  ORDER_STATUSES,
  orderDetail,
  recentAudit,
  roleOf,
  staffIssueInvoice,
  staffRefund,
  updateCoupon,
  type AdminDeps,
  type StaffRole,
} from '../modules/admin/admin';
import type { AppEnv } from '../types';

type AdminEnv = AppEnv & { Variables: AppEnv['Variables'] & { role: StaffRole } };

const staffOnly = createMiddleware<AdminEnv>(async (c, next) => {
  const role = await roleOf(c.var.deps.db, c.var.user.id);
  if (role === 'customer') throw new HttpError(403, 'forbidden', 'Staff only');
  c.set('role', role);
  await next();
});

const adminOnly = createMiddleware<AdminEnv>(async (c, next) => {
  if (c.var.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admins only');
  await next();
});

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_request', z.prettifyError(result.error));
  return result.data;
}

const currency = z.enum(['INR', 'AED', 'SAR']);
const isoDate = z.iso.datetime({ offset: true }).nullable();

const couponBody = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{3,20}$/),
  kind: z.enum(['percent', 'amount']),
  value: z.number().positive(),
  currency: currency.nullable().default(null),
  max_redemptions: z.number().int().positive().nullable().default(null),
  per_user_limit: z.number().int().positive().default(1),
  country_codes: z.array(z.string().regex(/^[A-Za-z]{2}$/)).default([]),
  starts_at: isoDate.default(null),
  ends_at: isoDate.default(null),
});

const deps = (c: { var: AdminEnv['Variables'] }): AdminDeps => ({ db: c.var.deps.db, env: c.var.deps.env, logger: c.var.logger, payments: c.var.deps.payments });

export const adminRoutes = new Hono<AdminEnv>()
  .use('/v1/admin/*', requireUser, staffOnly)
  .get('/v1/admin/me', (c) => c.json({ user_id: c.var.user.id, role: c.var.role }))
  .get('/v1/admin/orders', async (c) => {
    const query = parse(
      z.object({
        status: z.enum(ORDER_STATUSES).optional(),
        q: z.string().max(80).optional(),
        before: z.iso.datetime({ offset: true }).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
      c.req.query(),
    );
    return c.json(await listOrders(c.var.deps.db, { ...query, before: query.before ? new Date(query.before) : undefined }));
  })
  .get('/v1/admin/orders/:id', async (c) => c.json(await orderDetail(c.var.deps.db, c.var.deps.env, c.req.param('id'))))
  .post('/v1/admin/orders/:id/refund', adminOnly, async (c) => {
    const body = parse(z.object({ reason: z.string().trim().min(3).max(500) }), await c.req.json().catch(() => null));
    return c.json(await staffRefund(deps(c), c.var.user.id, c.req.param('id'), body.reason));
  })
  .post('/v1/admin/orders/:id/invoice', async (c) => c.json(await staffIssueInvoice(deps(c), c.var.user.id, c.req.param('id'))))
  .get('/v1/admin/coupons', async (c) => c.json(await listCoupons(c.var.deps.db)))
  .post('/v1/admin/coupons', adminOnly, async (c) => {
    const body = parse(couponBody, await c.req.json().catch(() => null));
    return c.json(await createCoupon(c.var.deps.db, c.var.user.id, body), 201);
  })
  .patch('/v1/admin/coupons/:code', adminOnly, async (c) => {
    const body = parse(
      z.object({
        ends_at: isoDate.optional(),
        max_redemptions: z.number().int().positive().nullable().optional(),
        per_user_limit: z.number().int().positive().optional(),
      }),
      await c.req.json().catch(() => null),
    );
    return c.json(await updateCoupon(c.var.deps.db, c.var.user.id, c.req.param('code'), body));
  })
  .post('/v1/admin/users/:id/credit', adminOnly, async (c) => {
    const body = parse(
      z.object({ amount: z.number().min(-100_000).max(100_000), currency, reason: z.string().trim().min(3).max(200) }),
      await c.req.json().catch(() => null),
    );
    await grantCredit(c.var.deps.db, c.var.user.id, c.req.param('id'), body);
    return c.body(null, 204);
  })
  .get('/v1/admin/audit', async (c) => c.json(await recentAudit(c.var.deps.db, c.req.query('target'))));
