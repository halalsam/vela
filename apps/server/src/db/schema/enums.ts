import { pgEnum } from 'drizzle-orm/pg-core';

export const currency = pgEnum('currency', ['INR', 'AED', 'SAR', 'QAR', 'USD', 'EUR']);
export const planType = pgEnum('plan_type', ['country', 'regional', 'global']);
export const regionType = pgEnum('region_type', ['regional', 'global']);
export const activationPolicy = pgEnum('activation_policy', ['on_install', 'on_first_connection']);
export const couponKind = pgEnum('coupon_kind', ['percent', 'amount']);
export const orderKind = pgEnum('order_kind', ['esim', 'top_up']);
export const orderStatus = pgEnum('order_status', [
  'draft',
  'awaiting_payment',
  'expired',
  'paid',
  'provisioning',
  'fulfilled',
  'provisioning_failed',
  'refunded',
]);
export const paymentProvider = pgEnum('payment_provider', ['razorpay', 'gulf', 'mock']);
export const paymentStatus = pgEnum('payment_status', ['created', 'authorized', 'captured', 'failed', 'refunded']);
export const esimStatus = pgEnum('esim_status', ['not_started', 'active', 'expired', 'depleted']);
export const devicePlatform = pgEnum('device_platform', ['ios', 'android', 'web']);
export const userRole = pgEnum('user_role', ['customer', 'support', 'admin']);
export const webhookSource = pgEnum('webhook_source', ['razorpay', 'gulf', 'esim']);
export const area = pgEnum('area', ['asia', 'europe', 'gulf', 'americas', 'africa', 'oceania']);
export const contentLocale = pgEnum('content_locale', ['en', 'ar']);
export const blogStatus = pgEnum('blog_status', ['draft', 'published']);
