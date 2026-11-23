import type { Checkout, PaymentResult } from '@vela/api';
import { colors } from '@vela/tokens';

export const MOCK_SIGNATURE = 'mock-signature';
const RAZORPAY_CANCELLED = 2;

export class PaymentCancelled extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'PaymentCancelled';
  }
}

export async function collectPayment(checkout: Checkout, description: string): Promise<PaymentResult | null> {
  const intent = checkout.payment;
  if (!intent) return null;
  if (intent.provider === 'mock') {
    return { payment_id: `mock_pay_${Date.now().toString(36)}`, signature: MOCK_SIGNATURE };
  }
  const { default: RazorpayCheckout } = await import('react-native-razorpay');
  try {
    const result = await RazorpayCheckout.open({
      key: intent.key,
      order_id: intent.provider_order_id,
      amount: intent.amount_minor,
      currency: intent.currency,
      name: 'vela',
      description,
      theme: { color: colors.accent.DEFAULT },
      notes: { order: checkout.order.number },
    });
    if (!result.razorpay_signature) throw new Error('Razorpay returned no signature');
    return { payment_id: result.razorpay_payment_id, signature: result.razorpay_signature };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === RAZORPAY_CANCELLED) throw new PaymentCancelled();
    throw error;
  }
}
