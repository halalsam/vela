import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CurrencyCode } from '../../lib/money';
import type { PaymentEvent, PaymentProvider } from './provider';

const API = 'https://api.razorpay.com/v1';

type RazorpayConfig = { keyId: string; keySecret: string; webhookSecret: string; fetch?: typeof fetch };

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeEqual(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Entity = { id?: string; order_id?: string; amount?: number; payment_id?: string };
type WebhookBody = { event?: string; payload?: { payment?: { entity?: Entity }; refund?: { entity?: Entity } } };

function toEvent(body: WebhookBody): PaymentEvent | null {
  const payment = body.payload?.payment?.entity;
  const refund = body.payload?.refund?.entity;
  if (body.event === 'payment.captured' && payment?.id && payment.order_id) {
    return { type: 'captured', providerOrderId: payment.order_id, providerPaymentId: payment.id, amountMinor: payment.amount ?? 0, raw: payment };
  }
  if (body.event === 'order.paid' && payment?.id && payment.order_id) {
    return { type: 'captured', providerOrderId: payment.order_id, providerPaymentId: payment.id, amountMinor: payment.amount ?? 0, raw: payment };
  }
  if (body.event === 'payment.failed' && payment?.id && payment.order_id) {
    return { type: 'failed', providerOrderId: payment.order_id, providerPaymentId: payment.id, raw: payment };
  }
  if (body.event === 'refund.processed' && refund?.payment_id) {
    return { type: 'refunded', providerPaymentId: refund.payment_id, raw: refund };
  }
  return null;
}

export function createRazorpay(config: RazorpayConfig): PaymentProvider {
  const request = config.fetch ?? fetch;
  const authorization = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`;

  async function post<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
    const response = await request(`${API}${path}`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json', 'x-razorpay-idempotency-key': idempotencyKey },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Razorpay ${path} failed with ${response.status}: ${text}`);
    return JSON.parse(text) as T;
  }

  return {
    name: 'razorpay',
    publicKey: config.keyId,
    supports: (currency: CurrencyCode) => ['INR', 'AED', 'SAR', 'EUR', 'USD'].includes(currency),
    async createPayment({ receipt, amountMinor, currency, orderId }) {
      const created = await post<{ id: string }>(
        '/orders',
        { amount: amountMinor, currency, receipt, notes: { order_id: orderId } },
        `order-${orderId}`,
      );
      return { providerOrderId: created.id };
    },
    verifyClientResult({ providerOrderId, paymentId, signature }) {
      return safeEqual(hmac(config.keySecret, `${providerOrderId}|${paymentId}`), signature);
    },
    parseWebhook(rawBody, headers) {
      const signature = headers.get('x-razorpay-signature');
      if (!signature || !safeEqual(hmac(config.webhookSecret, rawBody), signature)) return null;
      const body = JSON.parse(rawBody) as WebhookBody;
      const eventId = headers.get('x-razorpay-event-id') ?? hmac(config.webhookSecret, rawBody).slice(0, 32);
      return { eventId, type: body.event ?? 'unknown', payload: body, event: toEvent(body) };
    },
    async refund({ providerPaymentId, amountMinor, orderId }) {
      const refund = await post<{ id: string }>(
        `/payments/${encodeURIComponent(providerPaymentId)}/refund`,
        { amount: amountMinor, speed: 'normal', notes: { order_id: orderId } },
        `refund-${orderId}`,
      );
      return { refundId: refund.id };
    },
  };
}
