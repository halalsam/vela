import type { SellingCurrency } from './schemas';

const EURO_AREA = new Set(['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK']);

export function currencyForRegion(region: string | null | undefined): SellingCurrency {
  const code = region?.toUpperCase() ?? '';
  if (code === 'IN') return 'INR';
  if (code === 'AE') return 'AED';
  if (code === 'SA') return 'SAR';
  if (EURO_AREA.has(code)) return 'EUR';
  return code ? 'USD' : 'INR';
}
