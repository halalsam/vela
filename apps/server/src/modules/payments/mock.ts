import { randomUUID } from 'node:crypto';
import type { PaymentProvider } from './provider';

export const MOCK_SIGNATURE = 'mock-signature';

export function createMockPayments(): PaymentProvider {
  return {
    name: 'mock',
    publicKey: null,
    supports: () => true,
    async createPayment() {
      return { providerOrderId: `mock_order_${randomUUID()}` };
    },
    verifyClientResult: ({ signature }) => signature === MOCK_SIGNATURE,
    parseWebhook: () => null,
    async refund({ orderId }) {
      return { refundId: `mock_refund_${orderId}` };
    },
  };
}
