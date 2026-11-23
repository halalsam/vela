import type { Esim } from '@vela/api';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { esim, order, payment, plan } from '../../db/schema';
import type { Env } from '../../env';
import { JOB, type JobQueue } from '../../jobs/queue';
import { decrypt, encrypt } from '../../lib/crypto';
import { notFound } from '../../lib/errors';
import type { Logger } from '../../logger';
import type { EsimProvider } from '../esims/provider';
import type { PaymentProvider } from '../payments/provider';

export type FulfilDeps = {
  db: Database;
  env: Env;
  logger: Logger;
  provider: EsimProvider;
  payments: PaymentProvider;
  queue: JobQueue;
};

function labelFor(row: typeof plan.$inferSelect): string {
  const place = row.type === 'country' ? (row.countryCodes[0] ?? '') : (row.regionId ?? row.type);
  const size = row.dataMb >= 1024 ? `${Math.round(row.dataMb / 1024)} GB` : `${row.dataMb} MB`;
  return `${place.toUpperCase()} · ${size}`;
}

export async function provisionOrder(deps: FulfilDeps, orderId: string, options: { finalAttempt: boolean }): Promise<void> {
  const { db, logger } = deps;
  const [current] = await db
    .update(order)
    .set({ status: 'provisioning', updatedAt: new Date() })
    .where(and(eq(order.id, orderId), inArray(order.status, ['paid', 'provisioning'])))
    .returning();
  if (!current) {
    logger.info({ orderId }, 'order not ready to provision, skipping');
    return;
  }
  try {
    if (!current.planId) throw new Error('Order has no plan');
    const [planRow] = await db.select().from(plan).where(eq(plan.id, current.planId));
    if (!planRow) throw new Error(`Plan ${current.planId} is missing`);
    const bought = await deps.provider.purchase({ planRef: planRow.providerPlanRef, idempotencyKey: current.id });
    await db
      .insert(esim)
      .values({
        userId: current.userId,
        iccid: bought.iccid,
        planId: planRow.id,
        providerRef: bought.providerRef,
        label: labelFor(planRow),
        dataTotalMb: planRow.dataMb,
        smdp: bought.smdp,
        lpaEnc: encrypt(bought.lpa, deps.env.ENCRYPTION_KEY),
        activationCodeEnc: encrypt(bought.activationCode, deps.env.ENCRYPTION_KEY),
      })
      .onConflictDoNothing();
    const [stored] = await db.select({ id: esim.id, userId: esim.userId }).from(esim).where(eq(esim.iccid, bought.iccid));
    if (!stored || stored.userId !== current.userId) throw new Error('Provider returned an ICCID that belongs to someone else');
    await db
      .update(order)
      .set({ status: 'fulfilled', esimId: stored.id, fulfilledAt: new Date(), failureReason: null, updatedAt: new Date() })
      .where(eq(order.id, current.id));
    logger.info({ orderId, iccid: bought.iccid }, 'order fulfilled');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!options.finalAttempt) {
      logger.warn({ orderId, reason }, 'provisioning failed, will retry');
      throw error;
    }
    await db
      .update(order)
      .set({ status: 'provisioning_failed', failureReason: reason, updatedAt: new Date() })
      .where(eq(order.id, current.id));
    await deps.queue.send(JOB.refund, { orderId }, { singletonKey: orderId });
    logger.error({ orderId, reason }, 'provisioning failed for good, refund queued');
  }
}

export async function refundOrder(deps: FulfilDeps, orderId: string): Promise<void> {
  const { db, logger } = deps;
  const [current] = await db.select().from(order).where(eq(order.id, orderId));
  if (!current || current.status !== 'provisioning_failed') return;
  const [captured] = await db
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), inArray(payment.status, ['captured', 'refunded'])))
    .orderBy(desc(payment.createdAt))
    .limit(1);
  if (captured?.status === 'captured') {
    if (!captured.providerPaymentId) throw new Error('Captured payment has no provider payment ID');
    const { refundId } = await deps.payments.refund({
      providerPaymentId: captured.providerPaymentId,
      amountMinor: captured.amountMinor,
      orderId,
    });
    await db.update(payment).set({ status: 'refunded', updatedAt: new Date() }).where(eq(payment.id, captured.id));
    logger.info({ orderId, refundId }, 'payment refunded');
  }
  await db.update(order).set({ status: 'refunded', updatedAt: new Date() }).where(eq(order.id, orderId));
}

type EsimRow = typeof esim.$inferSelect;
type PlanRow = typeof plan.$inferSelect;

function toEsim(row: EsimRow, planRow: PlanRow, key: string): Esim {
  return {
    iccid: row.iccid,
    plan_id: row.planId,
    label: row.label,
    country_codes: planRow.countryCodes,
    network: planRow.networks[0] ?? 'Partner network',
    is_5g: planRow.is5g,
    status: row.status,
    data_used_mb: row.dataUsedMb,
    data_total_mb: row.dataTotalMb,
    activated_at: row.activatedAt?.toISOString() ?? null,
    expires_at: row.expiresAt?.toISOString() ?? null,
    lpa_string: decrypt(row.lpaEnc, key),
    qr_url: null,
  };
}

export async function listEsims(db: Database, userId: string, key: string): Promise<Esim[]> {
  const rows = await db
    .select({ esim, plan })
    .from(esim)
    .innerJoin(plan, eq(plan.id, esim.planId))
    .where(eq(esim.userId, userId))
    .orderBy(desc(esim.createdAt));
  return rows.map((row) => toEsim(row.esim, row.plan, key));
}

export async function esimByIccid(db: Database, userId: string, iccid: string, key: string): Promise<Esim> {
  const [row] = await db
    .select({ esim, plan })
    .from(esim)
    .innerJoin(plan, eq(plan.id, esim.planId))
    .where(and(eq(esim.userId, userId), eq(esim.iccid, iccid)));
  if (!row) throw notFound('eSIM');
  return toEsim(row.esim, row.plan, key);
}
