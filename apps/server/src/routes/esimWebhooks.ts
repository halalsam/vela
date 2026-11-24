import { createHash } from 'node:crypto';
import { and, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { esim, webhookEvent } from '../db/schema';
import { JOB } from '../jobs/queue';
import { HttpError } from '../lib/errors';
import { safeEqual } from '../modules/payments/razorpay';
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

const USAGE_EVENTS = new Set(['ESIM_STATUS', 'DATA_USAGE', 'VALIDITY_USAGE', 'SMDP_EVENT']);

type Notification = {
  notifyType?: string;
  notifyId?: string;
  content?: { esimTranNo?: string; iccid?: string };
};

export const esimWebhookRoutes = new Hono<AppEnv>().post('/v1/webhooks/esimaccess', async (c) => {
  const { env, db, queue } = c.var.deps;
  if (!env.ESIM_ACCESS_WEBHOOK_TOKEN) throw new HttpError(404, 'not_found', 'Route not found');
  if (!safeEqual(env.ESIM_ACCESS_WEBHOOK_TOKEN, c.req.query('token') ?? '')) throw new HttpError(403, 'forbidden', 'Invalid webhook token');
  if (env.ESIM_ACCESS_WEBHOOK_IP_CHECK) {
    const sender = (c.req.header('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
    if (!ESIM_ACCESS_SENDER_IPS.has(sender)) throw new HttpError(403, 'forbidden', 'Unknown webhook sender');
  }

  const raw = await c.req.text();
  let body: Notification;
  try {
    body = JSON.parse(raw) as Notification;
  } catch {
    throw new HttpError(400, 'bad_request', 'Webhook body is not JSON');
  }
  const type = body.notifyType ?? 'UNKNOWN';
  if (type === 'CHECK_HEALTH') return c.json({ ok: true });

  const eventId = body.notifyId || createHash('sha256').update(raw).digest('hex').slice(0, 32);
  await db.insert(webhookEvent).values({ source: 'esim', eventId, type, payload: body as object }).onConflictDoNothing();
  const match = and(eq(webhookEvent.source, 'esim'), eq(webhookEvent.eventId, eventId));
  const [stored] = await db.select().from(webhookEvent).where(match);
  if (stored?.processedAt) return c.json({ ok: true, duplicate: true });

  let queued = false;
  const tranNo = body.content?.esimTranNo;
  const iccid = body.content?.iccid;
  if (USAGE_EVENTS.has(type) && (tranNo || iccid)) {
    const conditions = [tranNo ? eq(esim.providerRef, tranNo) : undefined, iccid ? eq(esim.iccid, iccid) : undefined].filter(
      (value): value is NonNullable<typeof value> => value !== undefined,
    );
    const [found] = await db.select({ id: esim.id }).from(esim).where(or(...conditions));
    if (found) {
      await queue.send(JOB.usageOne, { esimId: found.id }, { singletonKey: found.id });
      queued = true;
    }
  }
  await db.update(webhookEvent).set({ processedAt: new Date(), error: null }).where(match);
  c.var.logger.info({ type, eventId, queued }, 'eSIM Access webhook');
  return c.json({ ok: true, duplicate: false, queued });
});
