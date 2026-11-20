import type { Offer } from '../schemas';
import { fromNow } from './time';

export const offers: Offer[] = [
  {
    id: 'gulf-weekend',
    title: { en: 'gulf weekend', ar: 'عطلة الخليج' },
    body: { en: '20% off every Gulf plan until Sunday.', ar: 'خصم 20٪ على كل باقات الخليج حتى الأحد.' },
    tag: { en: '20% off', ar: 'خصم 20٪' },
    code: 'GULF20',
    discount_pct: 20,
    country_codes: ['AE', 'SA', 'QA', 'BH', 'OM'],
    ends_at: fromNow(3),
  },
  {
    id: 'japan-autumn',
    title: { en: 'autumn in japan', ar: 'الخريف في اليابان' },
    body: { en: 'Double data on 10 GB plans.', ar: 'ضعف البيانات على باقات 10 جيجابايت.' },
    tag: { en: '2× data', ar: 'ضعف البيانات' },
    code: null,
    discount_pct: null,
    country_codes: ['JP'],
    ends_at: fromNow(12),
  },
  {
    id: 'first-trip',
    title: { en: 'your first trip', ar: 'رحلتك الأولى' },
    body: { en: '₹150 off your first eSIM.', ar: 'خصم ₹150 على أول شريحة.' },
    tag: { en: 'Welcome', ar: 'أهلًا بك' },
    code: 'FIRSTSAIL',
    discount_pct: null,
    country_codes: [],
    ends_at: null,
  },
];
