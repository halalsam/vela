'use client';

import { currencyForRegion, SELLING_CURRENCIES, type SellingCurrency } from '@vela/api';

const KEY = 'vela:currency';

function browserRegion(): string | undefined {
  try {
    return new Intl.Locale(navigator.language).maximize().region;
  } catch {
    return undefined;
  }
}

export function readCurrency(): SellingCurrency {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (SELLING_CURRENCIES as readonly string[]).includes(saved)) return saved as SellingCurrency;
  } catch {
    return currencyForRegion(browserRegion());
  }
  return currencyForRegion(browserRegion());
}

export function saveCurrency(currency: SellingCurrency) {
  try {
    localStorage.setItem(KEY, currency);
  } catch {
    return;
  }
}
