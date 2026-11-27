import type { Esim } from '@vela/api';
import type { Database } from '../db/client';
import type { Env } from '../env';
import type { EmailSender } from '../integrations/email';
import { providerFor } from '../integrations/esims';
import { ProviderUnavailable, type EsimProvider, type PurchasedEsim } from '../integrations/esims/provider';
import type { PaymentProvider } from '../integrations/payments/provider';
import type { PushSender } from '../integrations/push';
import { JOB, type JobQueue } from '../jobs/queue';
import { decrypt, encrypt } from '../lib/crypto';
import { notFound } from '../lib/errors';
import type { Logger } from '../logger';
import * as credits from '../models/credit.model';
import * as esims from '../models/esim.model';
import * as orders from '../models/order.model';
import * as payments from '../models/payment.model';
import * as plans from '../models/plan.model';
import { esimLabel, esimView } from '../views/esim.view';
import { issueCreditNote, issueInvoice } from './invoices.service';
import { pushLiveActivities, sendNotice } from './notify.service';
import { sendReceipt } from './receipt.service';

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

type OrderRow = orders.OrderRow;

const RESET_NOTICES = ['low_data', 'depleted', 'expiry_24h', 'expiry_2h'];
const DAY_MS = 86_400_000;

export class BackupStateUnknown extends Error {}

/** Buys from the primary supplier, falling back to the backup once when the primary refuses. */
async function buyWithFailover(deps: FulfilDeps, current: OrderRow, planRow: plans.PlanRow): Promise<{ bought: PurchasedEsim; supplier: string }> {
  const backup = deps.backupProvider;
  try {
    const bought = await deps.provider.purchase({ planRef: planRow.providerPlanRef, idempotencyKey: current.id });
    return { bought, supplier: deps.provider.name };
  } catch (error) {
    if (!(error instanceof ProviderUnavailable) || !backup || !planRow.backupProviderRef) throw error;
    if (current.backupAttemptedAt) {
      throw new BackupStateUnknown(`Backup purchase from ${backup.name} was already attempted; check the ${backup.name} portal before refunding`);
    }
    await orders.updateOrder(deps.db, current.id, { backupAttemptedAt: new Date() });
    deps.logger.warn({ orderId: current.id, reason: error.message, backup: backup.name }, 'primary supplier refused, buying from backup');
    const bought = await backup.purchase({ planRef: planRow.backupProviderRef, idempotencyKey: current.id });
    return { bought, supplier: backup.name };
  }
}

export async function provisionOrder(deps: FulfilDeps, orderId: string, options: { finalAttempt: boolean }): Promise<void> {
  const { db, logger } = deps;
  const current = await orders.transitionOrder(db, orderId, ['paid', 'provisioning'], 'provisioning');
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
    const planRow = await plans.findPlanRow(db, current.planId);
    if (!planRow) throw new Error(`Plan ${current.planId} is missing`);
    const { bought, supplier } = await buyWithFailover(deps, current, planRow);
    await esims.insertEsimIfNew(db, {
      userId: current.userId,
      iccid: bought.iccid,
      planId: planRow.id,
      providerRef: bought.providerRef,
      provider: supplier,
      label: esimLabel(planRow),
      dataTotalMb: planRow.dataMb,
      smdp: bought.smdp,
      lpaEnc: encrypt(bought.lpa, deps.env.ENCRYPTION_KEY),
      activationCodeEnc: encrypt(bought.activationCode, deps.env.ENCRYPTION_KEY),
    });
    const stored = await esims.findEsimByIccid(db, bought.iccid);
    if (!stored || stored.userId !== current.userId) throw new Error('Provider returned an ICCID that belongs to someone else');
    await orders.updateOrder(db, current.id, { status: 'fulfilled', esimId: stored.id, fulfilledAt: new Date(), failureReason: null });
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
    await orders.updateOrder(db, current.id, { status: 'provisioning_failed', failureReason: reason });
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

async function applyTopUp(deps: FulfilDeps, current: OrderRow): Promise<void> {
  const { db, logger } = deps;
  if (!current.esimId || !current.topUpPackId) throw new Error('Top-up order has no eSIM or pack');
  const target = await esims.findEsim(db, current.esimId);
  const pack = await plans.findTopUpPack(db, current.topUpPackId);
  if (!target || !pack) throw new Error('Top-up eSIM or pack is missing');
  await providerFor(deps.provider, deps.backupProvider, target.provider).topUp({
    iccid: target.iccid,
    providerRef: target.providerRef,
    packRef: pack.providerPackRef,
    idempotencyKey: current.id,
  });
  const updated = await db.transaction(async (tx) => {
    const claimed = await orders.transitionOrder(tx, current.id, ['provisioning'], 'fulfilled', { fulfilledAt: new Date(), failureReason: null });
    if (!claimed) return null;
    const expiresAt = target.expiresAt && pack.extraDays > 0 ? new Date(target.expiresAt.getTime() + pack.extraDays * DAY_MS) : target.expiresAt;
    const status = target.status === 'depleted' ? (target.activatedAt ? 'active' : 'not_started') : target.status;
    const row = await esims.updateEsim(tx, target.id, { dataTotalMb: target.dataTotalMb + pack.dataMb, expiresAt, status });
    await esims.resetNotices(tx, target.id, RESET_NOTICES);
    return row;
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
  const current = await orders.findOrder(deps.db, orderId);
  if (!current || current.status !== 'provisioning_failed') return;
  await settleRefund(deps, current, null);
}

export type RefundDeps = Pick<FulfilDeps, 'db' | 'payments' | 'logger'> & Partial<Pick<FulfilDeps, 'env' | 'provider' | 'backupProvider'>>;
export type RefundOutcome = { supplierCancelled: boolean | null; creditNote: string | null };

/** Cancels an unused eSIM with its supplier; null when there is nothing to cancel. */
async function cancelWithSupplier(deps: RefundDeps, current: OrderRow): Promise<boolean | null> {
  if (current.kind !== 'esim' || !current.esimId || !deps.provider) return null;
  const issued = await esims.findEsim(deps.db, current.esimId);
  if (!issued || issued.status !== 'not_started') return false;
  const supplier = providerFor(deps.provider, deps.backupProvider, issued.provider);
  if (!supplier.cancel) return false;
  try {
    const cancelled = await supplier.cancel({ iccid: issued.iccid, providerRef: issued.providerRef });
    if (cancelled) {
      await esims.updateEsim(deps.db, issued.id, { status: 'expired' });
      deps.logger.info({ orderId: current.id, iccid: issued.iccid, supplier: supplier.name }, 'eSIM cancelled with supplier');
    }
    return cancelled;
  } catch (error) {
    deps.logger.warn({ orderId: current.id, err: error }, 'supplier cancel failed; refund continues');
    return false;
  }
}

/** Refunds the captured payment and any credit used, marks the order refunded and issues a credit note. */
export async function settleRefund(deps: RefundDeps, current: OrderRow, reason: string | null): Promise<RefundOutcome> {
  const { db, logger } = deps;
  const orderId = current.id;
  const captured = await payments.latestSettledPaymentFor(db, orderId);
  if (captured?.status === 'captured') {
    if (!captured.providerPaymentId) throw new Error('Captured payment has no provider payment ID');
    const { refundId } = await deps.payments.refund({
      providerPaymentId: captured.providerPaymentId,
      amountMinor: captured.amountMinor,
      orderId,
    });
    await payments.updatePayment(db, captured.id, { status: 'refunded' });
    logger.info({ orderId, refundId }, 'payment refunded');
  }
  if (current.creditMinor > 0) {
    await credits.addCreditEntry(db, { userId: current.userId, amountMinor: current.creditMinor, currency: current.currency, reason: 'refund', orderId });
  }
  await orders.updateOrder(db, orderId, { status: 'refunded', ...(reason ? { failureReason: reason } : {}) });
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

export async function listEsims(db: Database, userId: string, key: string): Promise<Esim[]> {
  const rows = await esims.listUserEsimsWithPlan(db, userId);
  return rows.map((row) => esimView(row.esim, row.plan, decrypt(row.esim.lpaEnc, key)));
}

export async function esimByIccid(db: Database, userId: string, iccid: string, key: string): Promise<Esim> {
  const row = await esims.findUserEsimWithPlan(db, userId, iccid);
  if (!row) throw notFound('eSIM');
  return esimView(row.esim, row.plan, decrypt(row.esim.lpaEnc, key));
}
