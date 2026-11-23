import type { CurrencyCode } from '../../lib/money';
import type { ProviderPlan } from '../esims/provider';

export const SELLING_CURRENCIES: readonly CurrencyCode[] = ['INR', 'AED', 'SAR'];

export function charmPrice(minor: number, currency: CurrencyCode): number {
  if (currency === 'INR') {
    const major = Math.max(49, Math.ceil((minor / 100 + 1) / 50) * 50 - 1);
    return major * 100;
  }
  return Math.ceil(minor / 100) * 100 - 1;
}

export function retailPrices(
  source: Pick<ProviderPlan, 'cost' | 'suggestedRetail'>,
  marginPercent: number,
  currencies: readonly CurrencyCode[] = SELLING_CURRENCIES,
): { currency: CurrencyCode; amountMinor: number }[] {
  return currencies.flatMap((currency) => {
    const suggested = source.suggestedRetail.find((price) => price.currency === currency);
    if (suggested) return [{ currency, amountMinor: suggested.amountMinor }];
    if (source.cost.currency === currency) {
      return [{ currency, amountMinor: charmPrice(source.cost.amountMinor * (1 + marginPercent / 100), currency) }];
    }
    return [];
  });
}

export function planSlug(plan: Pick<ProviderPlan, 'type' | 'countryCodes' | 'regionRef' | 'dataMb' | 'validityDays'>): string {
  const scope = plan.type === 'country' ? (plan.countryCodes[0] ?? 'xx').toLowerCase() : (plan.regionRef ?? plan.type);
  const data = plan.dataMb % 1024 === 0 ? `${plan.dataMb / 1024}gb` : `${plan.dataMb}mb`;
  return `${scope}-${data}-${plan.validityDays}d`;
}

export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
