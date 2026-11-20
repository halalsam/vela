'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

export function notifyStorage() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useStorageValue(kind: 'local' | 'session', key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return (kind === 'local' ? localStorage : sessionStorage).getItem(key);
      } catch {
        return null;
      }
    },
    () => undefined,
  );
}
