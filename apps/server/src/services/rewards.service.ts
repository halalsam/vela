import type { Coupon, Rewards } from '@vela/api';
import { formatPrice } from '@vela/utils';
import type { Database } from '../db/client';
import type { PushSender } from '../integrations/push';
import { fromMinor, type CurrencyCode } from '../lib/money';
import type { Logger } from '../logger';
import * as credits from '../models/credit.model';
import * as esims from '../models/esim.model';
import * as orders from '../models/order.model';
import * as profiles from '../models/profile.model';
import { referralMessage } from '../views/messages.view';
import { amountCouponView } from '../views/order.view';
import { rewardsView } from '../views/rewards.view';
import { notifyUser } from './notify.service';

export const REFERRAL_REWARD_MINOR: Record<CurrencyCode, number> = { INR: 15_000, AED: 700, SAR: 700, QAR: 700, USD: 200, EUR: 200 };

export async function creditBalance(db: Database, userId: string, currency: CurrencyCode): Promise<number> {
  return Math.max(0, await credits.ledgerTotal(db, userId, currency));
}

export function referralCoupon(code: string, currency: CurrencyCode): Coupon {
  return amountCouponView(code, REFERRAL_REWARD_MINOR[currency], currency);
}

/**
 * The profile behind a referral code, if `userId` may use it: not their own code, not after another
 * friend referred them, and only before their first eSIM purchase.
 */
export async function findReferrer(db: Database, code: string, userId: string | null): Promise<profiles.ProfileRow | null> {
  const referrer = await profiles.findByReferralCode(db, code.trim().toUpperCase());
  if (!referrer) return null;
  if (!userId) return referrer;
  if (referrer.userId === userId) return null;
  const me = await profiles.findProfile(db, userId);
  if (me?.referredBy && me.referredBy !== referrer.userId) return null;
  return (await orders.countPaidEsimOrders(db, userId)) > 0 ? null : referrer;
}

/** Pays the referrer once the friend's first eSIM starts being used. */
export async function creditReferrerForEsim(db: Database, logger: Logger, esimId: string, push?: PushSender): Promise<boolean> {
  const bought = await orders.findReferredPurchase(db, esimId);
  if (!bought?.referralCode) return false;
  const referrer = await profiles.findByReferralCode(db, bought.referralCode);
  if (!referrer || referrer.userId === bought.userId) return false;
  const added = await credits.addCreditEntry(db, {
    userId: referrer.userId,
    amountMinor: REFERRAL_REWARD_MINOR[referrer.currency],
    currency: referrer.currency,
    reason: 'referral',
    orderId: bought.id,
  });
  if (!added) return false;
  logger.info({ referrer: referrer.userId, orderId: bought.id }, 'referral credit added');
  if (push) {
    const amount = formatPrice(fromMinor(REFERRAL_REWARD_MINOR[referrer.currency], referrer.currency), referrer.currency);
    try {
      await notifyUser({ db, logger, push }, referrer.userId, (locale) => referralMessage(locale, amount), { kind: 'referral_credit' });
    } catch (error) {
      logger.warn({ err: error, referrer: referrer.userId }, 'referral credit push failed');
    }
  }
  return true;
}

export async function rewardsFor(db: Database, userId: string, currency: CurrencyCode): Promise<Rewards> {
  const me = await profiles.findProfile(db, userId);
  const balance = await creditBalance(db, userId, currency);
  const trips = await esims.countUserEsims(db, userId);
  const friends = me ? await profiles.listReferredBy(db, userId) : [];
  const earned = me ? await credits.referralEarnings(db, userId) : [];
  return rewardsView({ me, balanceMinor: balance, currency, trips, friends, earned });
}
