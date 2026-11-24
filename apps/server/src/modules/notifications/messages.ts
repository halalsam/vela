import { formatData, isLowData } from '@vela/utils';

export type Locale = 'en' | 'ar';
export type NoticeKind = 'ready' | 'low_data' | 'depleted' | 'expiry_24h' | 'expiry_2h';

export function toLocale(value: string | null | undefined): Locale {
  return value?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const notices: Record<Locale, Record<NoticeKind, { title: string; body: string }>> = {
  en: {
    ready: { title: 'Your {{place}} eSIM is ready', body: 'Install it now so it’s set before you fly.' },
    low_data: { title: '{{place}}: {{left}} left', body: 'You’re running low on data. Top up in a tap to stay connected.' },
    depleted: { title: '{{place}}: data used up', body: 'Top up to get back online.' },
    expiry_24h: { title: '{{place}} plan ends tomorrow', body: 'Your plan ends in 24 hours. Top up to add more days.' },
    expiry_2h: { title: '{{place}} plan ends in 2 hours', body: 'Top up now if you need more time.' },
  },
  ar: {
    ready: { title: 'شريحة {{place}} جاهزة', body: 'ثبّتها الآن لتكون جاهزة قبل رحلتك.' },
    low_data: { title: '{{place}}: متبقٍ {{left}}', body: 'بياناتك أوشكت على النفاد. أعد الشحن بلمسة لتبقى متصلًا.' },
    depleted: { title: '{{place}}: نفدت البيانات', body: 'أعد الشحن لتعود إلى الإنترنت.' },
    expiry_24h: { title: 'باقة {{place}} تنتهي غدًا', body: 'تنتهي باقتك خلال 24 ساعة. أعد الشحن لإضافة أيام.' },
    expiry_2h: { title: 'باقة {{place}} تنتهي خلال ساعتين', body: 'أعد الشحن الآن إن احتجت إلى وقت إضافي.' },
  },
};

const statuses: Record<Locale, { notStarted: string; expired: string; low: string; active: string }> = {
  en: { notStarted: 'Not started', expired: 'Expired', low: 'Low data', active: 'Active' },
  ar: { notStarted: 'لم تبدأ', expired: 'منتهية', low: 'بيانات منخفضة', active: 'نشطة' },
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

export function noticeMessage(kind: NoticeKind, locale: Locale, values: { place: string; left: string }) {
  const entry = notices[locale][kind];
  return { title: fill(entry.title, values), body: fill(entry.body, values) };
}

export type UsageState = { status: string; usedMb: number; totalMb: number };

export function statusLabel(state: UsageState, locale: Locale): string {
  const text = statuses[locale];
  if (state.status === 'not_started') return text.notStarted;
  if (state.status === 'expired' || state.status === 'depleted') return text.expired;
  return isLowData(state.usedMb, state.totalMb) ? text.low : text.active;
}

export function leftLabel(state: UsageState): string {
  if (state.status === 'not_started') return formatData(state.totalMb);
  return formatData(Math.max(0, state.totalMb - state.usedMb));
}

const referral: Record<Locale, { title: string; body: string }> = {
  en: { title: 'You earned {{amount}} travel credit', body: 'Your friend’s eSIM just connected. Your credit applies at checkout automatically.' },
  ar: { title: 'حصلت على رصيد سفر بقيمة {{amount}}', body: 'اتصلت شريحة صديقك للتو. يُطبَّق رصيدك تلقائيًا عند الدفع.' },
};

export function referralMessage(locale: Locale, amount: string) {
  const entry = referral[locale];
  return { title: fill(entry.title, { amount }), body: fill(entry.body, { amount }) };
}
