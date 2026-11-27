import type { Context } from 'hono';
import type { AdminEnv } from '../auth/staff';
import * as admin from '../services/admin.service';
import { couponBody, couponPatch, creditBody, optionalDate, ordersQuery, parse, refundBody } from '../validators/admin.validators';

type C = Context<AdminEnv>;

const body = (c: C) => c.req.json().catch(() => null);

/** What the admin services need from the request context. */
export const adminDeps = (c: C): admin.AdminDeps => ({
  db: c.var.deps.db,
  env: c.var.deps.env,
  logger: c.var.logger,
  payments: c.var.deps.payments,
  provider: c.var.deps.esimProvider,
  backupProvider: c.var.deps.backupProvider,
});

export const me = (c: C) => c.json({ user_id: c.var.user.id, role: c.var.role });

export async function listOrders(c: C) {
  const query = parse(ordersQuery, c.req.query());
  return c.json(await admin.listOrders(c.var.deps.db, { ...query, before: optionalDate(query.before) }));
}

export const getOrder = async (c: C) => c.json(await admin.orderDetail(c.var.deps.db, c.var.deps.env, c.req.param('id') ?? ''));

export async function refundOrder(c: C) {
  const { reason } = parse(refundBody, await body(c));
  return c.json(await admin.staffRefund(adminDeps(c), c.var.user.id, c.req.param('id') ?? '', reason));
}

export const issueInvoice = async (c: C) => c.json(await admin.staffIssueInvoice(adminDeps(c), c.var.user.id, c.req.param('id') ?? ''));

export const listCoupons = async (c: C) => c.json(await admin.listCoupons(c.var.deps.db));

export async function createCoupon(c: C) {
  return c.json(await admin.createCoupon(c.var.deps.db, c.var.user.id, parse(couponBody, await body(c))), 201);
}

export async function updateCoupon(c: C) {
  return c.json(await admin.updateCoupon(c.var.deps.db, c.var.user.id, c.req.param('code') ?? '', parse(couponPatch, await body(c))));
}

export async function grantCredit(c: C) {
  await admin.grantCredit(c.var.deps.db, c.var.user.id, c.req.param('id') ?? '', parse(creditBody, await body(c)));
  return c.body(null, 204);
}

export const recentAudit = async (c: C) => c.json(await admin.recentAudit(c.var.deps.db, c.req.query('target')));
