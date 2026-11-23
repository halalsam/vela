import type { Coupon, Rewards } from '@vela/api';
import { and, count, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { creditLedger, esim, order, profile } from '../../db/schema';
import { fromMinor, type CurrencyCode } from '../../lib/money';
import type { Logger } from '../../logger';

export const REFERRAL_REWARD_MINOR: Record<CurrencyCode, number> = { INR: 15_000, AED: 700, SAR: 700, QAR: 700, USD: 200, EUR: 200 };

type ProfileRow = typeof profile.$inferSelect;
const PAID: (typeof order.$inferSelect.status)[] = ['paid', 'provisioning', 'fulfilled'];

export async function creditBalance(db: Database, userId: string, currency: CurrencyCode): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amountMinor}), 0)::int` })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.currency, currency)));
  return Math.max(0, row?.total ?? 0);
}

export function referralCoupon(code: string, currency: CurrencyCode): Coupon {
  return { code, discount_pct: null, discount_amount: fromMinor(REFERRAL_REWARD_MINOR[currency], currency), currency };
}

export async function findReferrer(db: Database, code: string, userId: string | null): Promise<ProfileRow | null> {
  const [referrer] = await db.select().from(profile).where(eq(profile.referralCode, code.trim().toUpperCase()));
  if (!referrer) return null;
  if (!userId) return referrer;
  if (referrer.userId === userId) return null;
  const [me] = await db.select({ referredBy: profile.referredBy }).from(profile).where(eq(profile.userId, userId));
  if (me?.referredBy && me.referredBy !== referrer.userId) return null;
  const [previous] = await db
    .select({ value: count() })
    .from(order)
    .where(and(eq(order.userId, userId), eq(order.kind, 'esim'), inArray(order.status, PAID)));
  return (previous?.value ?? 0) > 0 ? null : referrer;
}

export async function creditReferrerForEsim(db: Database, logger: Logger, esimId: string): Promise<boolean> {
  const [bought] = await db
    .select({ id: order.id, userId: order.userId, referralCode: order.referralCode })
    .from(order)
    .where(and(eq(order.esimId, esimId), eq(order.kind, 'esim'), isNotNull(order.referralCode)));
  if (!bought?.referralCode) return false;
  const [referrer] = await db.select().from(profile).where(eq(profile.referralCode, bought.referralCode));
  if (!referrer || referrer.userId === bought.userId) return false;
  const inserted = await db
    .insert(creditLedger)
    .values({
      userId: referrer.userId,
      amountMinor: REFERRAL_REWARD_MINOR[referrer.currency],
      currency: referrer.currency,
      reason: 'referral',
      orderId: bought.id,
    })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  if (inserted.length > 0) logger.info({ referrer: referrer.userId, orderId: bought.id }, 'referral credit added');
  return inserted.length > 0;
}

export async function rewardsFor(db: Database, userId: string, currency: CurrencyCode): Promise<Rewards> {
  const [me] = await db.select().from(profile).where(eq(profile.userId, userId));
  const balance = await creditBalance(db, userId, currency);
  const [trips] = await db.select({ value: count() }).from(esim).where(eq(esim.userId, userId));
  const friends = me ? await db.select().from(profile).where(eq(profile.referredBy, userId)) : [];
  const earned = me
    ? await db
        .select({ friend: order.userId, amount: creditLedger.amountMinor, currency: creditLedger.currency })
        .from(creditLedger)
        .innerJoin(order, eq(order.id, creditLedger.orderId))
        .where(and(eq(creditLedger.userId, userId), eq(creditLedger.reason, 'referral')))
    : [];
  return {
    code: me?.referralCode ?? '',
    balance: fromMinor(balance, currency),
    currency,
    trips: trips?.value ?? 0,
    referrals: friends.map((friend) => {
      const reward = earned.find((item) => item.friend === friend.userId);
      return {
        id: friend.userId,
        name: friend.name?.split(' ')[0] || friendLabel(friend.phone),
        status: reward ? ('travelled' as const) : ('joined' as const),
        reward: reward ? fromMinor(reward.amount, reward.currency) : 0,
      };
    }),
  };
}

function friendLabel(phone: string | null): string {
  return phone ? `••${phone.slice(-4)}` : 'Friend';
}
