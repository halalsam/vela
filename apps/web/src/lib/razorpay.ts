'use client';

import type { Checkout, PaymentResult } from '@vela/api';

const SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
export const MOCK_SIGNATURE = 'mock-signature';

type RazorpayResponse = { razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: 'payment.failed', handler: () => void): void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

export class PaymentCancelled extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'PaymentCancelled';
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

function loadRazorpay(): Promise<RazorpayConstructor> {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (loaded) resolve(loaded);
      else reject(new Error('Razorpay did not load'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Razorpay did not load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function collectWebPayment(
  checkout: Checkout,
  details: { email: string; description: string; color: string },
): Promise<PaymentResult | null> {
  const intent = checkout.payment;
  if (!intent) return null;
  if (intent.provider === 'mock') return { payment_id: `mock_pay_${Date.now().toString(36)}`, signature: MOCK_SIGNATURE };
  const Razorpay = await loadRazorpay();
  return new Promise<PaymentResult>((resolve, reject) => {
    const instance = new Razorpay({
      key: intent.key,
      order_id: intent.provider_order_id,
      amount: intent.amount_minor,
      currency: intent.currency,
      name: 'vela',
      description: details.description,
      prefill: { email: details.email },
      notes: { order: checkout.order.number },
      theme: { color: details.color },
      handler: (response: RazorpayResponse) =>
        resolve({ payment_id: response.razorpay_payment_id, signature: response.razorpay_signature }),
      modal: { ondismiss: () => reject(new PaymentCancelled()) },
    });
    instance.open();
  });
}
