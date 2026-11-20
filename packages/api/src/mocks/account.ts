import type { Coupon, Profile, Rewards, SupportMessage } from '../schemas';
import { fromNow } from './time';

export const profile: Profile = {
  name: 'Sameer Khan',
  email: 'traveller@example.com',
  phone: '+91 98•• ••4410',
  provider: 'apple',
};

export const rewards: Rewards = {
  code: 'SAMEER150',
  balance: 300,
  currency: 'INR',
  trips: 4,
  referrals: [
    { id: 'r1', name: 'Aisha', status: 'travelled', reward: 150 },
    { id: 'r2', name: 'Rohan', status: 'travelled', reward: 150 },
    { id: 'r3', name: 'Omar', status: 'joined', reward: 0 },
  ],
};

export const coupons: Coupon[] = [
  { code: 'GULF20', discount_pct: 20, discount_amount: null, currency: 'INR' },
  { code: 'FIRSTSAIL', discount_pct: null, discount_amount: 150, currency: 'INR' },
];

export const supportThread: SupportMessage[] = [
  {
    id: 'm1',
    from: 'agent',
    text: 'Hi, I’m Aisha from vela. How can I help?',
    sent_at: fromNow(0, -1),
    install_step: null,
  },
  {
    id: 'm2',
    from: 'user',
    text: 'My Japan eSIM installed but I have no data in Tokyo.',
    sent_at: fromNow(0, -1),
    install_step: null,
  },
  {
    id: 'm3',
    from: 'agent',
    text: 'Let’s fix that. Check that Data Roaming is on for the vela line, and that Cellular Data uses vela Japan.',
    sent_at: fromNow(0, -1),
    install_step: 4,
  },
];
