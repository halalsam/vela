import type { DailyUsage, Esim, TopUpPack } from '../schemas';
import { daysAgoDate, fromNow } from './time';

function lpa(code: string): string {
  return `LPA:1$smdp.example.com$${code}`;
}

export const esims: Esim[] = [
  {
    iccid: '8981100022233344455',
    plan_id: 'jp-10gb-15d',
    label: 'Japan · 10 GB',
    country_codes: ['JP'],
    network: 'NTT Docomo',
    is_5g: true,
    status: 'active',
    data_used_mb: 6349,
    data_total_mb: 10240,
    activated_at: fromNow(-8),
    expires_at: fromNow(6, 14),
    lpa_string: lpa('K2-JP7Q-A91X-4410'),
    qr_url: 'https://example.com/qr/8981100022233344455.png',
  },
  {
    iccid: '8966000011122233344',
    plan_id: 'th-3gb-7d',
    label: 'Thailand · 3 GB',
    country_codes: ['TH'],
    network: 'AIS',
    is_5g: false,
    status: 'not_started',
    data_used_mb: 0,
    data_total_mb: 3072,
    activated_at: null,
    expires_at: null,
    lpa_string: lpa('K2-TH3M-77PA-2201'),
    qr_url: 'https://example.com/qr/8966000011122233344.png',
  },
  {
    iccid: '8997100055566677788',
    plan_id: 'ae-3gb-7d',
    label: 'UAE · 3 GB',
    country_codes: ['AE'],
    network: 'Etisalat',
    is_5g: true,
    status: 'active',
    data_used_mb: 2662,
    data_total_mb: 3072,
    activated_at: fromNow(-5),
    expires_at: fromNow(1, 20),
    lpa_string: lpa('K2-AE9R-30LD-8812'),
    qr_url: 'https://example.com/qr/8997100055566677788.png',
  },
  {
    iccid: '8933000099988877766',
    plan_id: 'fr-3gb-7d',
    label: 'France · 3 GB',
    country_codes: ['FR'],
    network: 'Orange',
    is_5g: false,
    status: 'expired',
    data_used_mb: 3072,
    data_total_mb: 3072,
    activated_at: fromNow(-25),
    expires_at: fromNow(-18),
    lpa_string: lpa('K2-FR1Z-0P9Q-5510'),
    qr_url: 'https://example.com/qr/8933000099988877766.png',
  },
];

export const topUpPacks: TopUpPack[] = [
  { id: 'jp-topup-1', iccid: '8981100022233344455', data_mb: 1024, extra_days: 0, price: 199, currency: 'INR' },
  { id: 'jp-topup-3', iccid: '8981100022233344455', data_mb: 3072, extra_days: 0, price: 449, currency: 'INR' },
  { id: 'jp-topup-5', iccid: '8981100022233344455', data_mb: 5120, extra_days: 7, price: 649, currency: 'INR' },
];

export const dailyUsage: Record<string, DailyUsage[]> = {
  '8981100022233344455': [612, 1229, 921, 1434, 512, 1024, 617].map((used_mb, index) => ({
    date: daysAgoDate(6 - index),
    used_mb,
  })),
};
