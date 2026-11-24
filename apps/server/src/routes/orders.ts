import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { checkoutSchema, couponSchema, esimSchema, orderSchema, orderSummarySchema, paymentResultSchema, rewardsSchema, topUpPackSchema } from '@vela/api';
import { requireUser } from '../auth/middleware';
import { HttpError } from '../lib/errors';
import { esimByIccid, listEsims } from '../modules/orders/fulfil';
import {
  confirmPayment,
  createOrder,
  createTopUpOrder,
  getOrder,
  handlePaymentWebhook,
  listOrdersFor,
  listTopUpPacks,
  resolveDiscount,
  type OrderDeps,
} from '../modules/orders/service';
import { rewardsFor } from '../modules/rewards/credit';
import type { AppEnv } from '../types';

const sellingCurrency = z.enum(['INR', 'AED', 'SAR', 'EUR', 'USD']).default('INR');
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const failure = (description: string) => json(errorSchema, description);
const signedIn = { security: [{ bearer: [] }], middleware: requireUser };
const orderParams = z.object({ id: z.string() });

const validateCoupon = createRoute({
  method: 'post',
  path: '/v1/coupons/validate',
  tags: ['checkout'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ code: z.string().min(1).max(40), currency: sellingCurrency }) } } },
  },
  responses: { 200: json(couponSchema, 'The coupon and its discount'), 422: failure('Unknown, expired or not usable') },
});

const createOrderRoute = createRoute({
  method: 'post',
  path: '/v1/orders',
  tags: ['checkout'],
  ...signedIn,
  request: {
    headers: z.object({ 'idempotency-key': z.string().min(8).max(100) }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ plan_id: z.string().min(1), coupon_code: z.string().max(40).nullable().default(null), currency: sellingCurrency }),
        },
      },
    },
  },
  responses: {
    200: json(checkoutSchema, 'The priced order and what the client needs to collect payment'),
    401: failure('Not signed in'),
    404: failure('Plan not found'),
    422: failure('Coupon or currency not usable'),
  },
});

const listOrdersRoute = createRoute({
  method: 'get',
  path: '/v1/orders',
  tags: ['checkout'],
  ...signedIn,
  responses: { 200: json(z.array(orderSummarySchema), 'Paid orders, newest first, with their GST invoice number'), 401: failure('Not signed in') },
});

const getOrderRoute = createRoute({
  method: 'get',
  path: '/v1/orders/{id}',
  tags: ['checkout'],
  ...signedIn,
  request: { params: orderParams },
  responses: { 200: json(orderSchema, 'Order status'), 401: failure('Not signed in'), 404: failure('Order not found') },
});

const confirmRoute = createRoute({
  method: 'post',
  path: '/v1/orders/{id}/confirm',
  tags: ['checkout'],
  ...signedIn,
  request: { params: orderParams, body: { content: { 'application/json': { schema: paymentResultSchema } } } },
  responses: {
    200: json(orderSchema, 'Payment accepted; provisioning has started'),
    400: failure('Payment signature did not verify'),
    401: failure('Not signed in'),
    404: failure('Order not found'),
    409: failure('Nothing to confirm'),
  },
});

const esimsRoute = createRoute({
  method: 'get',
  path: '/v1/esims',
  tags: ['esims'],
  ...signedIn,
  responses: { 200: json(z.array(esimSchema), 'The traveller’s eSIMs, newest first'), 401: failure('Not signed in') },
});

const esimRoute = createRoute({
  method: 'get',
  path: '/v1/esims/{iccid}',
  tags: ['esims'],
  ...signedIn,
  request: { params: z.object({ iccid: z.string().regex(/^\d{19,20}$/) }) },
  responses: { 200: json(esimSchema, 'One eSIM'), 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

const iccidParams = z.object({ iccid: z.string().regex(/^\d{19,20}$/) });

const topUpPacksRoute = createRoute({
  method: 'get',
  path: '/v1/esims/{iccid}/top-ups',
  tags: ['esims'],
  ...signedIn,
  request: { params: iccidParams, query: z.object({ currency: sellingCurrency }) },
  responses: { 200: json(z.array(topUpPackSchema), 'Top-ups for this eSIM, smallest first'), 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

const topUpRoute = createRoute({
  method: 'post',
  path: '/v1/esims/{iccid}/top-ups',
  tags: ['esims'],
  ...signedIn,
  request: {
    params: iccidParams,
    headers: z.object({ 'idempotency-key': z.string().min(8).max(100) }),
    body: { content: { 'application/json': { schema: z.object({ pack_id: z.string().min(1), currency: sellingCurrency }) } } },
  },
  responses: {
    200: json(checkoutSchema, 'The priced top-up order and what the client needs to collect payment'),
    401: failure('Not signed in'),
    404: failure('eSIM not found'),
    422: failure('Top-up or currency not available'),
  },
});

const rewardsRoute = createRoute({
  method: 'get',
  path: '/v1/rewards',
  tags: ['rewards'],
  ...signedIn,
  request: { query: z.object({ currency: sellingCurrency }) },
  responses: { 200: json(rewardsSchema, 'Referral code, travel credit and invited friends'), 401: failure('Not signed in') },
});

function orderDeps(deps: AppEnv['Variables']['deps'], logger: AppEnv['Variables']['logger']): OrderDeps {
  return { db: deps.db, env: deps.env, payments: deps.payments, queue: deps.queue, logger };
}

export const orderRoutes = new OpenAPIHono<AppEnv>()
  .openapi(validateCoupon, async (c) => {
    const { code, currency } = c.req.valid('json');
    const session = await c.var.deps.auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    const discount = await resolveDiscount(c.var.deps.db, code, { currency, userId: session?.user.id });
    return c.json(discount.view, 200);
  })
  .openapi(createOrderRoute, async (c) => {
    const body = c.req.valid('json');
    const { 'idempotency-key': key } = c.req.valid('header');
    const checkout = await createOrder(
      orderDeps(c.var.deps, c.var.logger),
      c.var.user.id,
      { planId: body.plan_id, couponCode: body.coupon_code, currency: body.currency },
      key,
    );
    return c.json(checkout, 200);
  })
  .openapi(listOrdersRoute, async (c) => c.json(await listOrdersFor(c.var.deps.db, c.var.user.id), 200))
  .openapi(getOrderRoute, async (c) => c.json(await getOrder(c.var.deps.db, c.var.user.id, c.req.valid('param').id), 200))
  .openapi(confirmRoute, async (c) => {
    const result = await confirmPayment(orderDeps(c.var.deps, c.var.logger), c.var.user.id, c.req.valid('param').id, c.req.valid('json'));
    return c.json(result, 200);
  })
  .openapi(topUpPacksRoute, async (c) =>
    c.json(await listTopUpPacks(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid, c.req.valid('query').currency), 200),
  )
  .openapi(topUpRoute, async (c) => {
    const body = c.req.valid('json');
    const checkout = await createTopUpOrder(
      orderDeps(c.var.deps, c.var.logger),
      c.var.user.id,
      { iccid: c.req.valid('param').iccid, packId: body.pack_id, currency: body.currency },
      c.req.valid('header')['idempotency-key'],
    );
    return c.json(checkout, 200);
  })
  .openapi(rewardsRoute, async (c) => c.json(await rewardsFor(c.var.deps.db, c.var.user.id, c.req.valid('query').currency), 200))
  .openapi(esimsRoute, async (c) => c.json(await listEsims(c.var.deps.db, c.var.user.id, c.var.deps.env.ENCRYPTION_KEY), 200))
  .openapi(esimRoute, async (c) =>
    c.json(await esimByIccid(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid, c.var.deps.env.ENCRYPTION_KEY), 200),
  );

export const webhookRoutes = new OpenAPIHono<AppEnv>().post('/v1/webhooks/razorpay', async (c) => {
  if (c.var.deps.payments.name !== 'razorpay') throw new HttpError(404, 'not_found', 'Route not found');
  const raw = await c.req.text();
  const result = await handlePaymentWebhook(orderDeps(c.var.deps, c.var.logger), raw, c.req.raw.headers);
  return c.json({ ok: true, duplicate: result.duplicate }, 200);
});
