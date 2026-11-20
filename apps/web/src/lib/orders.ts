'use client';

import type { Esim, Order } from '@vela/api';

export type StoredOrder = { order: Order; esim: Esim; title: string };

const PREFIX = 'vela:order:';

export function saveOrder(entry: StoredOrder) {
  try {
    sessionStorage.setItem(`${PREFIX}${entry.order.order_id}`, JSON.stringify(entry));
  } catch {
    return;
  }
}

export function orderKey(orderId: string): string {
  return `${PREFIX}${orderId}`;
}

export function parseOrder(raw: string | null | undefined): StoredOrder | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOrder;
  } catch {
    return null;
  }
}

export function readOrder(orderId: string): StoredOrder | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${orderId}`);
    return raw ? (JSON.parse(raw) as StoredOrder) : null;
  } catch {
    return null;
  }
}

export function readAllOrders(): StoredOrder[] {
  try {
    return Object.keys(sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => JSON.parse(sessionStorage.getItem(key) ?? 'null') as StoredOrder | null)
      .filter((entry): entry is StoredOrder => entry !== null);
  } catch {
    return [];
  }
}
