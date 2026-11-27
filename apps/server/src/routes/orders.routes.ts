import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { checkoutSchema, couponSchema, esimSchema, orderSchema, orderSummarySchema, paymentResultSchema, rewardsSchema, topUpPackSchema } from '@vela/api';
import * as orders from '../controllers/orders.controller';
import type { AppEnv } from '../types';
import { failure, iccidParam, json, sellingCurrency, signedIn } from './openapi';

const orderParams = z.object({ id: z.string() });

export const validateCoupon = createRoute({
  method: 'post',
  path: '/v1/coupons/validate',
  tags: ['checkout'],
  request: {
    body: { content: { 'application/json': { schema: z.object({ code: z.string().min(1).max(40), currency: sellingCurrency }) } } },
  },
  responses: { 200: json(couponSchema, 'The coupon and its discount'), 422: failure('Unknown, expired or not usable') },
});

export const createOrderRoute = createRoute({
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

export const listOrdersRoute = createRoute({
  method: 'get',
  path: '/v1/orders',
  tags: ['checkout'],
  ...signedIn,
  responses: { 200: json(z.array(orderSummarySchema), 'Paid orders, newest first, with their GST invoice number'), 401: failure('Not signed in') },
});

export const getOrderRoute = createRoute({
  method: 'get',
  path: '/v1/orders/{id}',
  tags: ['checkout'],
  ...signedIn,
  request: { params: orderParams },
  responses: { 200: json(orderSchema, 'Order status'), 401: failure('Not signed in'), 404: failure('Order not found') },
});

export const confirmRoute = createRoute({
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

export const esimsRoute = createRoute({
  method: 'get',
  path: '/v1/esims',
  tags: ['esims'],
  ...signedIn,
  responses: { 200: json(z.array(esimSchema), 'The traveller’s eSIMs, newest first'), 401: failure('Not signed in') },
});

export const esimRoute = createRoute({
  method: 'get',
  path: '/v1/esims/{iccid}',
  tags: ['esims'],
  ...signedIn,
  request: { params: z.object({ iccid: iccidParam }) },
  responses: { 200: json(esimSchema, 'One eSIM'), 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

const iccidParams = z.object({ iccid: iccidParam });

export const topUpPacksRoute = createRoute({
  method: 'get',
  path: '/v1/esims/{iccid}/top-ups',
  tags: ['esims'],
  ...signedIn,
  request: { params: iccidParams, query: z.object({ currency: sellingCurrency }) },
  responses: { 200: json(z.array(topUpPackSchema), 'Top-ups for this eSIM, smallest first'), 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

export const topUpRoute = createRoute({
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

export const rewardsRoute = createRoute({
  method: 'get',
  path: '/v1/rewards',
  tags: ['rewards'],
  ...signedIn,
  request: { query: z.object({ currency: sellingCurrency }) },
  responses: { 200: json(rewardsSchema, 'Referral code, travel credit and invited friends'), 401: failure('Not signed in') },
});

export const orderRoutes = new OpenAPIHono<AppEnv>()
  .openapi(validateCoupon, orders.validateCoupon)
  .openapi(createOrderRoute, orders.createOrder)
  .openapi(listOrdersRoute, orders.listOrders)
  .openapi(getOrderRoute, orders.getOrder)
  .openapi(confirmRoute, orders.confirmPayment)
  .openapi(topUpPacksRoute, orders.listTopUpPacks)
  .openapi(topUpRoute, orders.createTopUp)
  .openapi(rewardsRoute, orders.rewards)
  .openapi(esimsRoute, orders.listEsims)
  .openapi(esimRoute, orders.getEsim);
