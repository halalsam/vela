import type { Context } from 'hono';
import type * as routes from '../routes/orders.routes';
import * as fulfilment from '../services/fulfilment.service';
import * as orders from '../services/orders.service';
import { rewardsFor } from '../services/rewards.service';
import type { AppEnv, Handler } from '../types';

function orderDeps(c: Context<AppEnv>): orders.OrderDeps {
  const { db, env, payments, queue } = c.var.deps;
  return { db, env, payments, queue, logger: c.var.logger };
}

export const validateCoupon: Handler<typeof routes.validateCoupon> = async (c) => {
  const { code, currency } = c.req.valid('json');
  // Signing in is optional here; when signed in, per-user limits apply.
  const session = await c.var.deps.auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
  const discount = await orders.resolveDiscount(c.var.deps.db, code, { currency, userId: session?.user.id });
  return c.json(discount.view, 200);
};

export const createOrder: Handler<typeof routes.createOrderRoute> = async (c) => {
  const body = c.req.valid('json');
  const checkout = await orders.createOrder(
    orderDeps(c),
    c.var.user.id,
    { planId: body.plan_id, couponCode: body.coupon_code, currency: body.currency },
    c.req.valid('header')['idempotency-key'],
  );
  return c.json(checkout, 200);
};

export const listOrders: Handler<typeof routes.listOrdersRoute> = async (c) => c.json(await orders.listOrdersFor(c.var.deps.db, c.var.user.id), 200);

export const getOrder: Handler<typeof routes.getOrderRoute> = async (c) =>
  c.json(await orders.getOrder(c.var.deps.db, c.var.user.id, c.req.valid('param').id), 200);

export const confirmPayment: Handler<typeof routes.confirmRoute> = async (c) =>
  c.json(await orders.confirmPayment(orderDeps(c), c.var.user.id, c.req.valid('param').id, c.req.valid('json')), 200);

export const listTopUpPacks: Handler<typeof routes.topUpPacksRoute> = async (c) =>
  c.json(await orders.listTopUpPacks(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid, c.req.valid('query').currency), 200);

export const createTopUp: Handler<typeof routes.topUpRoute> = async (c) => {
  const body = c.req.valid('json');
  const checkout = await orders.createTopUpOrder(
    orderDeps(c),
    c.var.user.id,
    { iccid: c.req.valid('param').iccid, packId: body.pack_id, currency: body.currency },
    c.req.valid('header')['idempotency-key'],
  );
  return c.json(checkout, 200);
};

export const rewards: Handler<typeof routes.rewardsRoute> = async (c) =>
  c.json(await rewardsFor(c.var.deps.db, c.var.user.id, c.req.valid('query').currency), 200);

export const listEsims: Handler<typeof routes.esimsRoute> = async (c) =>
  c.json(await fulfilment.listEsims(c.var.deps.db, c.var.user.id, c.var.deps.env.ENCRYPTION_KEY), 200);

export const getEsim: Handler<typeof routes.esimRoute> = async (c) =>
  c.json(await fulfilment.esimByIccid(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid, c.var.deps.env.ENCRYPTION_KEY), 200);
