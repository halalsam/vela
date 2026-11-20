import type en from '@/app/[lang]/dictionaries/en.json';

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export type Dictionary = typeof en;

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}

export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

export function plural(
  group: Record<string, string>,
  base: string,
  count: number,
  locale: Locale,
  values: Record<string, string | number> = {},
): string {
  const category = new Intl.PluralRules(locale).select(count);
  const template = group[`${base}_${category}`] ?? group[`${base}_other`] ?? '';
  return format(template, { count, ...values });
}

export function localized(value: { en: string; ar: string }, locale: Locale): string {
  return value[locale];
}

export function path(locale: Locale, rest = ''): string {
  return `/${locale}${rest}`;
}
