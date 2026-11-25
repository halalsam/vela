import { readingMinutes, type BlogLocale, type BlogPost } from '../schemas';
import { fromNow } from './time';

type Draft = Omit<BlogPost, 'reading_minutes' | 'seo'> & { seo?: Partial<BlogPost['seo']> };

const noSeo: BlogPost['seo'] = { meta_title: null, meta_description: null, canonical_url: null, og_image: null, keywords: [], noindex: false };

function post(draft: Draft): BlogPost {
  return { ...draft, reading_minutes: readingMinutes(draft.body, draft.locale), seo: { ...noSeo, ...draft.seo } };
}

const team = { name: 'The vela team', role: 'Travel desk' };
const teamAr = { name: 'فريق vela', role: 'مكتب السفر' };

export const blogPosts: BlogPost[] = [
  post({
    slug: 'install-esim-iphone',
    locale: 'en',
    title: 'How to install a travel eSIM on iPhone, step by step',
    excerpt: 'Install before you fly, switch on when you land. The whole setup takes about two minutes, and you keep your home number for calls and OTPs.',
    cover_image: null,
    cover_alt: '',
    author: team,
    tags: ['Guides', 'iPhone'],
    country_codes: ['JP', 'TH', 'AE'],
    published_at: fromNow(-3),
    updated_at: fromNow(-1),
    alternate_slug: 'tathbit-esim-iphone',
    seo: {
      meta_title: 'Install a travel eSIM on iPhone in 2 minutes',
      meta_description: 'A step-by-step guide to installing a travel eSIM on iPhone: check your phone is unlocked, scan the QR code, and turn on data roaming when you land.',
      keywords: ['install esim iphone', 'travel esim', 'esim setup'],
    },
    body: `Setting up a travel eSIM on iPhone takes about two minutes. Do it at home on Wi-Fi, a day or two before you fly, and your data will be ready the moment the plane lands.

## Before you start

- **Your iPhone must be carrier-unlocked.** Go to *Settings → General → About* and look for *Carrier Lock: No SIM restrictions*.
- **iPhone XS, XR or newer.** Every model since 2018 supports eSIM.
- **A stable connection.** The eSIM profile downloads once, so use Wi-Fi.

## Install the eSIM

1. Open *Settings → Mobile Data → Add eSIM*.
2. Choose *Use QR Code* and scan the code from your vela confirmation email or the app.
3. Label the new line **Travel** so it is easy to spot later.
4. When asked, keep your home line as the default for calls and messages.
5. Set **Travel** as the line for mobile data.

> Tip: installing does not start your plan. Most vela plans start the first time the eSIM connects to a network abroad.

## When you land

Turn on *Data Roaming* for the Travel line only, under *Settings → Mobile Data → Travel*. Leave roaming off on your home line so it never uses data abroad.

## If it doesn't connect

Toggle Airplane Mode on and off, then check that the Travel line is selected for mobile data. Still stuck? Message us from the app and a real person will walk you through it.`,
  }),
  post({
    slug: 'esim-vs-roaming',
    locale: 'en',
    title: 'eSIM or roaming pack: what a week abroad really costs',
    excerpt: 'Roaming packs are easy but expensive per gigabyte. We compared a typical week in Japan, Thailand and the UAE to see where the money goes.',
    cover_image: null,
    cover_alt: '',
    author: team,
    tags: ['Money', 'Planning'],
    country_codes: ['JP', 'TH', 'AE'],
    published_at: fromNow(-9),
    updated_at: fromNow(-9),
    alternate_slug: null,
    body: `A roaming pack from your home network is the easiest option. It is rarely the cheapest. Here is how the numbers work out for a typical seven-day trip.

## How much data does a week take?

Maps, messaging, a few photos and the odd video call add up to roughly **1 to 1.5 GB a day**. A week is usually 5 to 10 GB, more if you hotspot a laptop.

## Where roaming packs lose

Roaming packs are priced per day, so you pay for every day of the trip whether you use data or not. Many also slow down sharply after a daily cap.

## Where an eSIM wins

A travel eSIM is priced per plan: a fixed amount of data for a set number of days. You keep your home SIM in the phone for calls and bank OTPs, and use the eSIM for data only.

## The quick rule

- **Trip under 2 days:** a roaming pack is fine.
- **Trip of 3 days or more:** an eSIM is almost always cheaper per gigabyte.
- **Several countries:** a regional plan covers them all on one eSIM.`,
  }),
  post({
    slug: 'is-my-phone-esim-ready',
    locale: 'en',
    title: 'Is my phone eSIM-ready? A 30-second check',
    excerpt: 'Most phones from the last five years support eSIM, but carrier locks and some regional models are the exception. Here is how to check.',
    cover_image: null,
    cover_alt: '',
    author: team,
    tags: ['Guides'],
    country_codes: [],
    published_at: fromNow(-16),
    updated_at: fromNow(-16),
    alternate_slug: null,
    body: `Before you buy, make sure your phone can take an eSIM. It takes less than a minute.

## Dial *#06#

If your screen shows an **EID** number, your phone supports eSIM. No EID usually means no eSIM.

## Check the lock

A phone bought on a contract may be locked to one network. Locked phones cannot use a travel eSIM until the carrier unlocks them, which most do for free once the contract ends.

## Watch for regional models

Some phones sold in mainland China, Hong Kong and Macau ship with two physical SIM slots instead of eSIM. If you bought your phone abroad, check the model number.`,
  }),
  post({
    slug: 'one-esim-for-the-gulf',
    locale: 'en',
    title: 'One eSIM for the whole Gulf: Dubai, Doha and Riyadh',
    excerpt: 'Hopping between the UAE, Qatar and Saudi Arabia? A regional plan keeps you on one line across borders, with no swapping at the airport.',
    cover_image: null,
    cover_alt: '',
    author: team,
    tags: ['Destinations', 'Gulf'],
    country_codes: ['AE', 'QA', 'SA', 'BH', 'OM'],
    published_at: fromNow(-24),
    updated_at: fromNow(-20),
    alternate_slug: 'esim-wahid-lilkhalij',
    body: `Business trips in the Gulf rarely stay in one country. A regional eSIM means one install, one line and one top-up across the region.

## Which countries are covered

Our Gulf plan covers the UAE, Saudi Arabia, Qatar, Bahrain and Oman on local partner networks, with 5G where the network offers it.

## Calls and apps

Some voice and video apps are restricted in parts of the region. Data works everywhere; check local rules for internet calling before you rely on it.

## Crossing a border

Nothing to do. Your phone moves to the partner network in the next country on its own. If it doesn't, toggle Airplane Mode once.`,
  }),
  post({
    slug: 'tathbit-esim-iphone',
    locale: 'ar',
    title: 'كيف تثبّت شريحة eSIM للسفر على آيفون خطوة بخطوة',
    excerpt: 'ثبّتها قبل السفر وفعّلها عند الوصول. يستغرق الإعداد دقيقتين تقريبًا، ويبقى رقمك الأساسي للمكالمات ورموز التحقق.',
    cover_image: null,
    cover_alt: '',
    author: teamAr,
    tags: ['أدلة', 'آيفون'],
    country_codes: ['JP', 'TH', 'AE'],
    published_at: fromNow(-3),
    updated_at: fromNow(-1),
    alternate_slug: 'install-esim-iphone',
    body: `يستغرق إعداد شريحة eSIM للسفر على آيفون دقيقتين تقريبًا. ثبّتها في المنزل على شبكة Wi-Fi قبل السفر بيوم أو يومين.

## قبل أن تبدأ

- **يجب أن يكون هاتفك غير مقفل على شركة اتصالات.**
- **آيفون XS أو XR أو أحدث.**
- **اتصال مستقر بالإنترنت.**

## ثبّت الشريحة

1. افتح *الإعدادات ← البيانات الخلوية ← إضافة eSIM*.
2. اختر *استخدام رمز QR* وامسح الرمز من بريد التأكيد.
3. سمِّ الخط الجديد **سفر**.
4. اجعل خطك الأساسي للمكالمات والرسائل.
5. اختر **سفر** للبيانات الخلوية.

## عند الوصول

فعّل *تجوال البيانات* لخط السفر فقط، واتركه مغلقًا على خطك الأساسي.`,
  }),
  post({
    slug: 'esim-wahid-lilkhalij',
    locale: 'ar',
    title: 'شريحة eSIM واحدة للخليج كله: دبي والدوحة والرياض',
    excerpt: 'تتنقل بين الإمارات وقطر والسعودية؟ الباقة الإقليمية تبقيك على خط واحد عبر الحدود دون تبديل في المطار.',
    cover_image: null,
    cover_alt: '',
    author: teamAr,
    tags: ['وجهات', 'الخليج'],
    country_codes: ['AE', 'QA', 'SA', 'BH', 'OM'],
    published_at: fromNow(-24),
    updated_at: fromNow(-20),
    alternate_slug: 'one-esim-for-the-gulf',
    body: `نادرًا ما تبقى رحلات العمل في الخليج داخل بلد واحد. الشريحة الإقليمية تعني تثبيتًا واحدًا وخطًا واحدًا في المنطقة كلها.

## الدول المشمولة

تغطي باقة الخليج الإمارات والسعودية وقطر والبحرين وعُمان عبر شبكات شريكة محلية، مع 5G حيث تتوفر.

## عبور الحدود

لا شيء عليك فعله. ينتقل هاتفك إلى الشبكة الشريكة في البلد التالي تلقائيًا.`,
  }),
];

export function blogPostsFor(locale: BlogLocale): BlogPost[] {
  return blogPosts.filter((item) => item.locale === locale).sort((a, b) => b.published_at.localeCompare(a.published_at));
}
