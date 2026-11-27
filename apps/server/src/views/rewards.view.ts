import type { Rewards } from '@vela/api';
import { fromMinor, type CurrencyCode } from '../lib/money';
import type { ProfileRow } from '../models/profile.model';

type Earning = { friend: string; amount: number; currency: CurrencyCode };

function friendLabel(phone: string | null): string {
  return phone ? `••${phone.slice(-4)}` : 'Friend';
}

export function rewardsView(input: {
  me: ProfileRow | null;
  balanceMinor: number;
  currency: CurrencyCode;
  trips: number;
  friends: ProfileRow[];
  earned: Earning[];
}): Rewards {
  return {
    code: input.me?.referralCode ?? '',
    balance: fromMinor(input.balanceMinor, input.currency),
    currency: input.currency,
    trips: input.trips,
    referrals: input.friends.map((friend) => {
      const reward = input.earned.find((item) => item.friend === friend.userId);
      return {
        id: friend.userId,
        name: friend.name?.split(' ')[0] || friendLabel(friend.phone),
        status: reward ? ('travelled' as const) : ('joined' as const),
        reward: reward ? fromMinor(reward.amount, reward.currency) : 0,
      };
    }),
  };
}
