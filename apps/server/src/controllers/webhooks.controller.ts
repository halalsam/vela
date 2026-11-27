import type { Context } from 'hono';
import { safeEqual } from '../integrations/payments/razorpay';
import { HttpError } from '../lib/errors';
import { handleEsimAccessWebhook } from '../services/esimWebhooks.service';
import { handlePaymentWebhook } from '../services/orders.service';
import type { AppEnv } from '../types';

export const ESIM_ACCESS_SENDER_IPS = new Set([
  '3.1.131.226',
  '54.254.74.88',
  '18.136.190.97',
  '18.136.60.197',
  '18.136.19.137',
  '54.151.164.206',
  '52.76.129.149',
  '18.142.83.98',
]);

const notFoundRoute = () => new HttpError(404, 'not_found', 'Route not found');

export async function razorpay(c: Context<AppEnv>) {
  const { db, env, payments, queue } = c.var.deps;
  if (payments.name !== 'razorpay') throw notFoundRoute();
  const result = await handlePaymentWebhook({ db, env, payments, queue, logger: c.var.logger }, await c.req.text(), c.req.raw.headers);
  return c.json({ ok: true, duplicate: result.duplicate }, 200);
}

export async function esimAccess(c: Context<AppEnv>) {
  const { env, db, queue } = c.var.deps;
  if (!env.ESIM_ACCESS_WEBHOOK_TOKEN) throw notFoundRoute();
  if (!safeEqual(env.ESIM_ACCESS_WEBHOOK_TOKEN, c.req.query('token') ?? '')) throw new HttpError(403, 'forbidden', 'Invalid webhook token');
  if (env.ESIM_ACCESS_WEBHOOK_IP_CHECK) {
    const sender = (c.req.header('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
    if (!ESIM_ACCESS_SENDER_IPS.has(sender)) throw new HttpError(403, 'forbidden', 'Unknown webhook sender');
  }
  const result = await handleEsimAccessWebhook({ db, queue }, await c.req.text());
  if (result.type === 'CHECK_HEALTH') return c.json({ ok: true });
  if (result.duplicate) return c.json({ ok: true, duplicate: true });
  c.var.logger.info({ type: result.type, eventId: result.eventId, queued: result.queued }, 'eSIM Access webhook');
  return c.json({ ok: true, duplicate: false, queued: result.queued });
}
