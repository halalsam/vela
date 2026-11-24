import type { PgBoss } from 'pg-boss';

export const JOB = {
  provision: 'esim.provision',
  refund: 'esim.refund',
  expireOrders: 'orders.expire',
  usage: 'esim.usage',
  usageOne: 'esim.usage.one',
  fx: 'fx.refresh',
} as const;

export type OrderJob = { orderId: string };
export type EsimJob = { esimId: string };

export type JobQueue = {
  send(name: string, data: object, options?: { singletonKey?: string }): Promise<void>;
};

export function bossQueue(boss: PgBoss): JobQueue {
  return {
    async send(name, data, options) {
      await boss.send(name, data, options?.singletonKey ? { singletonKey: options.singletonKey } : undefined);
    },
  };
}

export function memoryQueue(): JobQueue & { sent: { name: string; data: object }[] } {
  const sent: { name: string; data: object }[] = [];
  return {
    sent,
    async send(name, data) {
      sent.push({ name, data });
    },
  };
}
