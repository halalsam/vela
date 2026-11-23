import type { Esim } from '@vela/api';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { creditLedger, esim, esimNotice, order, payment, plan, topUpPack } from '../../db/schema';
import type { Env } from '../../env';
import { JOB, type JobQueue } from '../../jobs/queue';
import { decrypt, encrypt } from '../../lib/crypto';
import { notFound } from '../../lib/errors';
import type { Logger } from '../../logger';
import { ProviderUnavailable, type EsimProvider, type PurchasedEsim } from '../esims/provider';
import { providerFor } from '../esims/providers';
import { issueCreditNote, issueInvoice } from '../invoices/invoice';
import type { EmailSender } from '../notifications/email';
import { pushLiveActivities, sendNotice } from '../notifications/notify';
import { sendReceipt } from '../notifications/receipt';
import type { PushSender } from '../notifications/push';
import type { PaymentProvider } from '../payments/provider';

export type FulfilDeps = {
  db: Database;
  env: Env;
  logger: Logger;
  provider: EsimProvider;
  backupProvider?: EsimProvider | null;
  payments: PaymentProvider;
  queue: JobQueue;
  push: PushSender;
  email?: EmailSender;
};

function labelFor(row: typeof plan.$inferSelect): string {
  const place = row.type === 'country' ? (row.countryCodes[0] ?? '') : (row.regionId ?? row.type);
  const size = row.dataMb >= 1024 ? `${Math.round(row.dataMb / 1024)} GB` : `${row.dataMb} MB`;
  return `${place.toUpperCase()} · ${size}`;
}

export class BackupStateUnknown extends Error {}

async function buyWithFailover(
  deps: FulfilDeps,
  current: typeof order.$inferSelect,
  planRow: typeof plan.$inferSelect,
): Promise<{ bought: PurchasedEsim; supplier: string }> {
  const backup = deps.backupProvider;
  try {
    const bought = await deps.provider.purchase({ planRef: planRow.providerPlanRef, idempotencyKey: current.id });
    return { bought, supplier: deps.provider.name };
  } catch (error) {
    if (!(error instanceof ProviderUnavailable) || !backup || !planRow.backupProviderRef) throw error;
    if (current.backupAttemptedAt) {
      throw new BackupStateUnknown(`Backup purchase from ${backup.name} was already attempted; check the ${backup.name} portal before refunding`);
    }
    await deps.db.update(order).set({ backupAttemptedAt: new Date(), updatedAt: new Date() }).where(eq(order.id, current.id));
    deps.logger.warn({ orderId: current.id, reason: error.message, backup: backup.name }, 'primary supplier refused, buying from backup');
    const bought = await backup.purchase({ planRef: planRow.backupProviderRef, idempotencyKey: current.id });
    return { bought, supplier: backup.name };
  }
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
    if (current.kind === 'top_up') {
      await applyTopUp(deps, current);
      return;
    }
    if (!current.planId) throw new Error('Order has no plan');
    const [planRow] = await db.select().from(plan).where(eq(plan.id, current.planId));
    if (!planRow) throw new Error(`Plan ${current.planId} is missing`);
    const { bought, supplier } = await buyWithFailover(deps, current, planRow);
    await db
      .insert(esim)
      .values({
        userId: current.userId,
        iccid: bought.iccid,
        planId: planRow.id,
        providerRef: bought.providerRef,
        provider: supplier,
        label: labelFor(planRow),
        dataTotalMb: planRow.dataMb,
        smdp: bought.smdp,
        lpaEnc: encrypt(bought.lpa, deps.env.ENCRYPTION_KEY),
        activationCodeEnc: encrypt(bought.activationCode, deps.env.ENCRYPTION_KEY),
      })
      .onConflictDoNothing();
    const [stored] = await db.select().from(esim).where(eq(esim.iccid, bought.iccid));
    if (!stored || stored.userId !== current.userId) throw new Error('Provider returned an ICCID that belongs to someone else');
    await db
      .update(order)
      .set({ status: 'fulfilled', esimId: stored.id, fulfilledAt: new Date(), failureReason: null, updatedAt: new Date() })
      .where(eq(order.id, current.id));
    logger.info({ orderId, iccid: bought.iccid }, 'order fulfilled');
    await issueInvoiceSafely(deps, orderId);
    try {
      await sendNotice(deps, stored, 'ready');
    } catch (error) {
      logger.warn({ orderId, err: error }, 'ready push failed');
    }
    if (deps.email) {
      try {
        await sendReceipt({ db, env: deps.env, logger, email: deps.email }, orderId);
      } catch (error) {
        logger.warn({ orderId, err: error }, 'receipt email failed');
      }
    }
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

async function issueInvoiceSafely(deps: FulfilDeps, orderId: string) {
  try {
    await issueInvoice(deps.db, deps.env, deps.logger, orderId);
  } catch (error) {
    deps.logger.error({ orderId, err: error }, 'invoice could not be issued');
  }
}

const RESET_NOTICES = ['low_data', 'depleted', 'expiry_24h', 'expiry_2h'];
const DAY_MS = 86_400_000;

async function applyTopUp(deps: FulfilDeps, current: typeof order.$inferSelect): Promise<void> {
  const { db, logger } = deps;
  if (!current.esimId || !current.topUpPackId) throw new Error('Top-up order has no eSIM or pack');
  const [target] = await db.select().from(esim).where(eq(esim.id, current.esimId));
  const [pack] = await db.select().from(topUpPack).where(eq(topUpPack.id, current.topUpPackId));
  if (!target || !pack) throw new Error('Top-up eSIM or pack is missing');
  await providerFor(deps.provider, deps.backupProvider, target.provider).topUp({ iccid: target.iccid, providerRef: target.providerRef, packRef: pack.providerPackRef, idempotencyKey: current.id });
  const updated = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(order)
      .set({ status: 'fulfilled', fulfilledAt: new Date(), failureReason: null, updatedAt: new Date() })
      .where(and(eq(order.id, current.id), eq(order.status, 'provisioning')))
      .returning({ id: order.id });
    if (!claimed) return null;
    const expiresAt = target.expiresAt && pack.extraDays > 0 ? new Date(target.expiresAt.getTime() + pack.extraDays * DAY_MS) : target.expiresAt;
    const status = target.status === 'depleted' ? (target.activatedAt ? 'active' : 'not_started') : target.status;
    const [row] = await tx
      .update(esim)
      .set({ dataTotalMb: target.dataTotalMb + pack.dataMb, expiresAt, status, updatedAt: new Date() })
      .where(eq(esim.id, target.id))
      .returning();
    await tx.delete(esimNotice).where(and(eq(esimNotice.esimId, target.id), inArray(esimNotice.kind, RESET_NOTICES)));
    return row ?? null;
  });
  if (!updated) return;
  logger.info({ orderId: current.id, iccid: target.iccid, addedMb: pack.dataMb }, 'top-up applied');
  await issueInvoiceSafely(deps, current.id);
  try {
    await pushLiveActivities(deps, updated);
  } catch (error) {
    logger.warn({ orderId: current.id, err: error }, 'Live Activity update after top-up failed');
  }
}

export async function refundOrder(deps: FulfilDeps, orderId: string): Promise<void> {
  const [current] = await deps.db.select().from(order).where(eq(order.id, orderId));
  if (!current || current.status !== 'provisioning_failed') return;
  await settleRefund(deps, current, null);
}

export type RefundDeps = Pick<FulfilDeps, 'db' | 'payments' | 'logger'> & Partial<Pick<FulfilDeps, 'env' | 'provider' | 'backupProvider'>>;
export type RefundOutcome = { supplierCancelled: boolean | null; creditNote: string | null };

async function cancelWithSupplier(deps: RefundDeps, current: typeof order.$inferSelect): Promise<boolean | null> {
  if (current.kind !== 'esim' || !current.esimId || !deps.provider) return null;
  const [issued] = await deps.db.select().from(esim).where(eq(esim.id, current.esimId));
  if (!issued || issued.status !== 'not_started') return false;
  const supplier = providerFor(deps.provider, deps.backupProvider, issued.provider);
  if (!supplier.cancel) return false;
  try {
    const cancelled = await supplier.cancel({ iccid: issued.iccid, providerRef: issued.providerRef });
    if (cancelled) {
      await deps.db.update(esim).set({ status: 'expired', updatedAt: new Date() }).where(eq(esim.id, issued.id));
      deps.logger.info({ orderId: current.id, iccid: issued.iccid, supplier: supplier.name }, 'eSIM cancelled with supplier');
    }
    return cancelled;
  } catch (error) {
    deps.logger.warn({ orderId: current.id, err: error }, 'supplier cancel failed; refund continues');
    return false;
  }
}

export async function settleRefund(deps: RefundDeps, current: typeof order.$inferSelect, reason: string | null): Promise<RefundOutcome> {
  const { db, logger } = deps;
  const orderId = current.id;
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
  if (current.creditMinor > 0) {
    await db
      .insert(creditLedger)
      .values({ userId: current.userId, amountMinor: current.creditMinor, currency: current.currency, reason: 'refund', orderId })
      .onConflictDoNothing();
  }
  await db
    .update(order)
    .set({ status: 'refunded', ...(reason ? { failureReason: reason } : {}), updatedAt: new Date() })
    .where(eq(order.id, orderId));
  const supplierCancelled = await cancelWithSupplier(deps, current);
  let creditNote: string | null = null;
  if (deps.env) {
    try {
      creditNote = (await issueCreditNote(db, deps.env, logger, orderId))?.number ?? null;
    } catch (error) {
      logger.error({ orderId, err: error }, 'credit note could not be issued');
    }
  }
  return { supplierCancelled, creditNote };
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
