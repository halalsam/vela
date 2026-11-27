import { Hono } from 'hono';
import * as webhooks from '../controllers/webhooks.controller';
import type { AppEnv } from '../types';

/** Calls from our payment and eSIM suppliers. They read the raw body, so they sit outside OpenAPI validation. */
export const webhookRoutes = new Hono<AppEnv>().post('/v1/webhooks/razorpay', webhooks.razorpay).post('/v1/webhooks/esimaccess', webhooks.esimAccess);
