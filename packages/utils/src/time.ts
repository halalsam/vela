export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
};

export function countdownParts(expiresAt: string | Date, now: number = Date.now()): CountdownParts {
  const end = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
  const totalMs = Math.max(0, end - now);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    expired: totalMs === 0,
  };
}

export function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export const DAY_MS = 86_400_000;

export function isEndingSoon(parts: CountdownParts, withinMs = DAY_MS): boolean {
  return !parts.expired && parts.totalMs <= withinMs;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatShortDate(iso: string, language: 'en' | 'ar'): string {
  const locale = language === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(iso));
}
