import type { Env } from '../../env';
import { createMockPayments } from './mock';
import type { PaymentProvider } from './provider';
import { createRazorpay } from './razorpay';

export function createPaymentProvider(env: Env): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    return createRazorpay({
      keyId: env.RAZORPAY_KEY_ID ?? '',
      keySecret: env.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? '',
    });
  }
  return createMockPayments();
}
