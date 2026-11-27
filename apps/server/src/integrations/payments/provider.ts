import type { CurrencyCode } from '../../lib/money';

export type CreatedPayment = { providerOrderId: string };

export type PaymentEvent =
  | { type: 'captured'; providerOrderId: string; providerPaymentId: string; amountMinor: number; raw: unknown }
  | { type: 'failed'; providerOrderId: string; providerPaymentId: string; raw: unknown }
  | { type: 'refunded'; providerPaymentId: string; raw: unknown };

export type ParsedWebhook = { eventId: string; type: string; payload: unknown; event: PaymentEvent | null };

export type PaymentProvider = {
  name: 'mock' | 'razorpay';
  publicKey: string | null;
  supports(currency: CurrencyCode): boolean;
  createPayment(input: { receipt: string; amountMinor: number; currency: CurrencyCode; orderId: string }): Promise<CreatedPayment>;
  verifyClientResult(input: { providerOrderId: string; paymentId: string; signature: string }): boolean;
  parseWebhook(rawBody: string, headers: Headers): ParsedWebhook | null;
  refund(input: { providerPaymentId: string; amountMinor: number; orderId: string }): Promise<{ refundId: string }>;
};
