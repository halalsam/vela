import { z } from 'zod';

export const currencySchema = z.enum(['INR', 'AED', 'SAR', 'QAR', 'USD']);
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);

export const planSchema = z.object({
  id: z.string(),
  type: z.enum(['country', 'regional', 'global']),
  country_codes: z.array(countryCodeSchema).min(1),
  data_mb: z.number().int().positive(),
  validity_days: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: currencySchema,
  networks: z.array(z.string()),
  is_5g: z.boolean(),
  hotspot: z.boolean(),
  activation: z.enum(['on_install', 'on_first_connection']),
});

export const countrySchema = z.object({
  code: countryCodeSchema,
  name: z.object({ en: z.string(), ar: z.string() }),
  region: z.enum(['asia', 'europe', 'gulf', 'americas', 'africa', 'oceania']),
  popular: z.boolean(),
  from_price: z.number().nonnegative(),
  currency: currencySchema,
});

export const regionSchema = z.object({
  id: z.string(),
  name: z.object({ en: z.string(), ar: z.string() }),
  country_codes: z.array(countryCodeSchema).min(1),
  from_price: z.number().nonnegative(),
  currency: currencySchema,
});

export const esimStatusSchema = z.enum(['not_started', 'active', 'expired', 'depleted']);

export const esimSchema = z.object({
  iccid: z.string().regex(/^\d{19,20}$/),
  plan_id: z.string(),
  label: z.string(),
  country_codes: z.array(countryCodeSchema).min(1),
  network: z.string(),
  is_5g: z.boolean(),
  status: esimStatusSchema,
  data_used_mb: z.number().nonnegative(),
  data_total_mb: z.number().positive(),
  activated_at: z.iso.datetime().nullable(),
  expires_at: z.iso.datetime().nullable(),
  lpa_string: z.string().startsWith('LPA:1$'),
  qr_url: z.url().nullable(),
});

export const offerSchema = z.object({
  id: z.string(),
  title: z.object({ en: z.string(), ar: z.string() }),
  body: z.object({ en: z.string(), ar: z.string() }),
  tag: z.object({ en: z.string(), ar: z.string() }),
  code: z.string().nullable(),
  discount_pct: z.number().min(0).max(100).nullable(),
  country_codes: z.array(countryCodeSchema),
  ends_at: z.iso.datetime().nullable(),
});

export const topUpPackSchema = z.object({
  id: z.string(),
  iccid: z.string(),
  data_mb: z.number().int().positive(),
  extra_days: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  currency: currencySchema,
});

export const dailyUsageSchema = z.object({
  date: z.iso.date(),
  used_mb: z.number().nonnegative(),
});

export type Currency = z.infer<typeof currencySchema>;
export type Plan = z.infer<typeof planSchema>;
export type Country = z.infer<typeof countrySchema>;
export type Region = z.infer<typeof regionSchema>;
export type EsimStatus = z.infer<typeof esimStatusSchema>;
export type Esim = z.infer<typeof esimSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type TopUpPack = z.infer<typeof topUpPackSchema>;
export type DailyUsage = z.infer<typeof dailyUsageSchema>;
export type Localized = { en: string; ar: string };

export const couponSchema = z.object({
  code: z.string(),
  discount_pct: z.number().min(0).max(100).nullable(),
  discount_amount: z.number().nonnegative().nullable(),
  currency: currencySchema,
});

export const orderStatusSchema = z.enum([
  'awaiting_payment',
  'expired',
  'paid',
  'provisioning',
  'fulfilled',
  'provisioning_failed',
  'refunded',
]);

export const orderSchema = z.object({
  order_id: z.string(),
  number: z.string(),
  kind: z.enum(['esim', 'top_up']),
  status: orderStatusSchema,
  plan_id: z.string(),
  iccid: z.string().nullable(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  credit: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: currencySchema,
});

export const paymentIntentSchema = z.object({
  provider: z.enum(['razorpay', 'mock']),
  key: z.string().nullable(),
  provider_order_id: z.string(),
  amount_minor: z.number().int().nonnegative(),
  currency: currencySchema,
});

export const checkoutSchema = z.object({
  order: orderSchema,
  payment: paymentIntentSchema.nullable(),
});

export const paymentResultSchema = z.object({
  payment_id: z.string().min(1),
  signature: z.string().min(1),
});

export const referralSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['joined', 'travelled']),
  reward: z.number().nonnegative(),
});

export const rewardsSchema = z.object({
  code: z.string(),
  balance: z.number().nonnegative(),
  currency: currencySchema,
  trips: z.number().int().nonnegative(),
  referrals: z.array(referralSchema),
});

export const supportMessageSchema = z.object({
  id: z.string(),
  from: z.enum(['agent', 'user']),
  text: z.string(),
  sent_at: z.iso.datetime(),
  install_step: z.number().int().min(1).max(4).nullable(),
});

export const profileSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  provider: z.enum(['apple', 'google', 'phone']),
});

export type Coupon = z.infer<typeof couponSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type Checkout = z.infer<typeof checkoutSchema>;
export type PaymentResult = z.infer<typeof paymentResultSchema>;
export type Referral = z.infer<typeof referralSchema>;
export type Rewards = z.infer<typeof rewardsSchema>;
export type SupportMessage = z.infer<typeof supportMessageSchema>;
export type Profile = z.infer<typeof profileSchema>;
