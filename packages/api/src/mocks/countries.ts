import type { Country, Region } from '../schemas';

type Row = [Country['code'], string, string, Country['region'], number, boolean];

const rows: Row[] = [
  ['AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'gulf', 699, true],
  ['TH', 'Thailand', 'تايلاند', 'asia', 399, true],
  ['JP', 'Japan', 'اليابان', 'asia', 499, true],
  ['ID', 'Indonesia', 'إندونيسيا', 'asia', 449, true],
  ['SG', 'Singapore', 'سنغافورة', 'asia', 549, true],
  ['GB', 'United Kingdom', 'المملكة المتحدة', 'europe', 649, true],
  ['SA', 'Saudi Arabia', 'السعودية', 'gulf', 799, false],
  ['QA', 'Qatar', 'قطر', 'gulf', 749, false],
  ['BH', 'Bahrain', 'البحرين', 'gulf', 699, false],
  ['OM', 'Oman', 'عُمان', 'gulf', 699, false],
  ['MY', 'Malaysia', 'ماليزيا', 'asia', 399, false],
  ['VN', 'Vietnam', 'فيتنام', 'asia', 449, false],
  ['LK', 'Sri Lanka', 'سريلانكا', 'asia', 349, false],
  ['MV', 'Maldives', 'جزر المالديف', 'asia', 899, false],
  ['TR', 'Türkiye', 'تركيا', 'europe', 599, false],
  ['FR', 'France', 'فرنسا', 'europe', 549, false],
  ['DE', 'Germany', 'ألمانيا', 'europe', 549, false],
  ['IT', 'Italy', 'إيطاليا', 'europe', 549, false],
  ['ES', 'Spain', 'إسبانيا', 'europe', 549, false],
  ['CH', 'Switzerland', 'سويسرا', 'europe', 899, false],
  ['US', 'United States', 'الولايات المتحدة', 'americas', 799, false],
  ['EG', 'Egypt', 'مصر', 'africa', 599, false],
];

export const countries: Country[] = rows.map(([code, en, ar, region, from_price, popular]) => ({
  code,
  name: { en, ar },
  region,
  popular,
  from_price,
  currency: 'INR',
}));

export const regions: Region[] = [
  { id: 'asia', name: { en: 'Asia', ar: 'آسيا' }, country_codes: ['JP', 'TH', 'ID', 'SG', 'MY', 'VN'], from_price: 899, currency: 'INR' },
  { id: 'europe', name: { en: 'Europe', ar: 'أوروبا' }, country_codes: ['FR', 'DE', 'IT', 'ES', 'CH', 'GB'], from_price: 1099, currency: 'INR' },
  { id: 'gulf', name: { en: 'Gulf', ar: 'الخليج' }, country_codes: ['AE', 'SA', 'QA', 'BH', 'OM'], from_price: 999, currency: 'INR' },
  { id: 'global', name: { en: 'Global', ar: 'عالمي' }, country_codes: ['US', 'GB', 'AE', 'JP', 'TH', 'FR'], from_price: 1499, currency: 'INR' },
];
