export type CurrencyCode = 'INR' | 'AED' | 'SAR' | 'QAR' | 'USD';
export type AppLanguage = 'en' | 'ar';

const localeByCurrency: Record<CurrencyCode, string> = {
  INR: 'en-IN',
  AED: 'en-AE',
  SAR: 'en-SA',
  QAR: 'en-QA',
  USD: 'en-US',
};

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(`${localeByCurrency[currency]}-u-nu-latn`, {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'INR' ? 'narrowSymbol' : 'code',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, cached);
  }
  return cached;
}

export function fractionDigitsFor(amount: number): number {
  return Number.isInteger(amount) ? 0 : 2;
}

export function formatPrice(amount: number, currency: CurrencyCode): string {
  return formatter(currency, fractionDigitsFor(amount)).format(amount).replace(/ /g, ' ');
}
