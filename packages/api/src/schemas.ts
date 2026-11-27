import { z } from 'zod';

export const currencySchema = z.enum(['INR', 'AED', 'SAR', 'QAR', 'USD', 'EUR']);
export const SELLING_CURRENCIES = ['INR', 'AED', 'SAR', 'EUR', 'USD'] as const;
export type SellingCurrency = (typeof SELLING_CURRENCIES)[number];
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);

export const planSchema = z.object({
  id: z.string(),
  type: z.enum(['country', 'regional', 'global']),
  country_codes: z.array(countryCodeSchema).min(1),
  data_mb: z.number().int().positive(),
  validity_days: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: currencySchema,
  networks: z.array(z.string()),
  is_5g: z.boolean(),
  hotspot: z.boolean(),
  activation: z.enum(['on_install', 'on_first_connection']),
});

export const countrySchema = z.object({
  code: countryCodeSchema,
  name: z.object({ en: z.string(), ar: z.string() }),
  region: z.enum(['asia', 'europe', 'gulf', 'americas', 'africa', 'oceania']),
  popular: z.boolean(),
  from_price: z.number().nonnegative(),
  currency: currencySchema,
});

export const regionSchema = z.object({
  id: z.string(),
  name: z.object({ en: z.string(), ar: z.string() }),
  country_codes: z.array(countryCodeSchema).min(1),
  from_price: z.number().nonnegative(),
  currency: currencySchema,
});

export const esimStatusSchema = z.enum(['not_started', 'active', 'expired', 'depleted']);

export const esimSchema = z.object({
  iccid: z.string().regex(/^\d{19,20}$/),
  plan_id: z.string(),
  label: z.string(),
  country_codes: z.array(countryCodeSchema).min(1),
  network: z.string(),
  is_5g: z.boolean(),
  status: esimStatusSchema,
  data_used_mb: z.number().nonnegative(),
  data_total_mb: z.number().positive(),
  activated_at: z.iso.datetime().nullable(),
  expires_at: z.iso.datetime().nullable(),
  lpa_string: z.string().startsWith('LPA:1$'),
  qr_url: z.url().nullable(),
});

export const offerSchema = z.object({
  id: z.string(),
  title: z.object({ en: z.string(), ar: z.string() }),
  body: z.object({ en: z.string(), ar: z.string() }),
  tag: z.object({ en: z.string(), ar: z.string() }),
  code: z.string().nullable(),
  discount_pct: z.number().min(0).max(100).nullable(),
  country_codes: z.array(countryCodeSchema),
  ends_at: z.iso.datetime().nullable(),
});

export const topUpPackSchema = z.object({
  id: z.string(),
  iccid: z.string(),
  data_mb: z.number().int().positive(),
  extra_days: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  currency: currencySchema,
});

export const dailyUsageSchema = z.object({
  date: z.iso.date(),
  used_mb: z.number().nonnegative(),
});

export type Currency = z.infer<typeof currencySchema>;
export type Plan = z.infer<typeof planSchema>;
export type Country = z.infer<typeof countrySchema>;
export type Region = z.infer<typeof regionSchema>;
export type EsimStatus = z.infer<typeof esimStatusSchema>;
export type Esim = z.infer<typeof esimSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type TopUpPack = z.infer<typeof topUpPackSchema>;
export type DailyUsage = z.infer<typeof dailyUsageSchema>;
export type Localized = { en: string; ar: string };

export const couponSchema = z.object({
  code: z.string(),
  discount_pct: z.number().min(0).max(100).nullable(),
  discount_amount: z.number().nonnegative().nullable(),
  currency: currencySchema,
});

export const orderStatusSchema = z.enum([
  'awaiting_payment',
  'expired',
  'paid',
  'provisioning',
  'fulfilled',
  'provisioning_failed',
  'refunded',
]);

export const orderSchema = z.object({
  order_id: z.string(),
  number: z.string(),
  kind: z.enum(['esim', 'top_up']),
  status: orderStatusSchema,
  plan_id: z.string(),
  iccid: z.string().nullable(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  credit: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: currencySchema,
});

export const orderSummarySchema = orderSchema.extend({
  created_at: z.iso.datetime(),
  invoice_number: z.string().nullable(),
});

export const paymentIntentSchema = z.object({
  provider: z.enum(['razorpay', 'mock']),
  key: z.string().nullable(),
  provider_order_id: z.string(),
  amount_minor: z.number().int().nonnegative(),
  currency: currencySchema,
});

export const checkoutSchema = z.object({
  order: orderSchema,
  payment: paymentIntentSchema.nullable(),
});

export const invoiceLinkSchema = z.object({
  number: z.string(),
  url: z.url(),
  expires_at: z.iso.datetime(),
});

export const paymentResultSchema = z.object({
  payment_id: z.string().min(1),
  signature: z.string().min(1),
});

export const referralSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['joined', 'travelled']),
  reward: z.number().nonnegative(),
});

export const rewardsSchema = z.object({
  code: z.string(),
  balance: z.number().nonnegative(),
  currency: currencySchema,
  trips: z.number().int().nonnegative(),
  referrals: z.array(referralSchema),
});

export const supportMessageSchema = z.object({
  id: z.string(),
  from: z.enum(['agent', 'user']),
  text: z.string(),
  sent_at: z.iso.datetime(),
  install_step: z.number().int().min(1).max(4).nullable(),
});

export const supportRatingStatusSchema = z.object({
  /** Staff resolved the chat and would like a 1 to 5 rating. */
  asked: z.boolean(),
});

export const profileSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  provider: z.enum(['apple', 'google', 'phone']),
});

export type Coupon = z.infer<typeof couponSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type Checkout = z.infer<typeof checkoutSchema>;
export type PaymentResult = z.infer<typeof paymentResultSchema>;
export type InvoiceLink = z.infer<typeof invoiceLinkSchema>;
export type Referral = z.infer<typeof referralSchema>;
export type Rewards = z.infer<typeof rewardsSchema>;
export type SupportMessage = z.infer<typeof supportMessageSchema>;
export type SupportRatingStatus = z.infer<typeof supportRatingStatusSchema>;
export type Profile = z.infer<typeof profileSchema>;

export const blogLocaleSchema = z.enum(['en', 'ar']);

export const blogSeoSchema = z.object({
  /** Overrides the title in search results and link previews. Null uses the post title. */
  meta_title: z.string().nullable(),
  /** Overrides the excerpt as the meta description. */
  meta_description: z.string().nullable(),
  /** Set only when the post first appeared elsewhere. Null makes the post its own canonical. */
  canonical_url: z.string().nullable(),
  /** Social preview image. Null uses the cover, then a generated card. */
  og_image: z.string().nullable(),
  keywords: z.array(z.string()),
  noindex: z.boolean(),
});

export const blogPostSummarySchema = z.object({
  slug: z.string(),
  locale: blogLocaleSchema,
  title: z.string(),
  excerpt: z.string(),
  cover_image: z.string().nullable(),
  cover_alt: z.string(),
  author: z.object({ name: z.string(), role: z.string().nullable() }),
  tags: z.array(z.string()),
  country_codes: z.array(countryCodeSchema),
  reading_minutes: z.number().int().min(1),
  published_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const blogPostSchema = blogPostSummarySchema.extend({
  /** Markdown. */
  body: z.string(),
  /** Slug of the same post in the other language, for hreflang. */
  alternate_slug: z.string().nullable(),
  seo: blogSeoSchema,
});

export type BlogLocale = z.infer<typeof blogLocaleSchema>;
export type BlogSeo = z.infer<typeof blogSeoSchema>;
export type BlogPostSummary = z.infer<typeof blogPostSummarySchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;

/** Minutes to read a markdown body: ~220 words a minute in English, ~180 in Arabic, at least one. */
export function readingMinutes(body: string, locale: BlogLocale): number {
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_`[\]()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / (locale === 'ar' ? 180 : 220)));
}

// Site-wide and per-page SEO, edited in the admin. Every field is optional: null (or empty) means "use the site's
// built-in default", so an empty table still gives every page a full set of tags.

export const seoChangeFrequencySchema = z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

export const seoPageSchema = z.object({
  /** Page key: "home", "destinations", "destination" (template for every destination), "destination:jp" (one destination), "faq", … */
  key: z.string(),
  locale: blogLocaleSchema,
  /** Search title. Destination keys accept {{name}}, {{price}} and {{countries}}. */
  meta_title: z.string().nullable(),
  meta_description: z.string().nullable(),
  keywords: z.array(z.string()),
  /** Link-preview overrides. Null uses the meta title and description. */
  og_title: z.string().nullable(),
  og_description: z.string().nullable(),
  og_image: z.string().nullable(),
  og_image_alt: z.string().nullable(),
  /** Only to point search engines at a different URL. Null makes the page its own canonical. */
  canonical_url: z.string().nullable(),
  noindex: z.boolean(),
  nofollow: z.boolean(),
  /** 0 to 1. Null uses the default for the page type. */
  sitemap_priority: z.number().min(0).max(1).nullable(),
  change_frequency: seoChangeFrequencySchema.nullable(),
  /** Extra JSON-LD (an object or an array of objects), added next to the structured data the page already emits. */
  structured_data: z.string().nullable(),
  updated_at: z.iso.datetime({ offset: true }),
});

const seoLocaleSiteSchema = z.object({
  site_name: z.string().nullable(),
  default_title: z.string().nullable(),
  default_description: z.string().nullable(),
  keywords: z.array(z.string()),
});

export const seoSiteSchema = z.object({
  /** "%s" is the page title, e.g. "%s · vela". Null uses that. */
  title_template: z.string().nullable(),
  default_og_image: z.string().nullable(),
  /** X handle with the @, for twitter:site. */
  twitter_site: z.string().nullable(),
  organization: z.object({
    name: z.string().nullable(),
    legal_name: z.string().nullable(),
    logo: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    /** Social profile URLs for Organization.sameAs. */
    same_as: z.array(z.string()),
  }),
  verification: z.object({
    google: z.string().nullable(),
    bing: z.string().nullable(),
    yandex: z.string().nullable(),
    pinterest: z.string().nullable(),
  }),
  /** False hides the whole site from search engines (staging). */
  indexing: z.boolean(),
  /** Extra paths for robots.txt Disallow. */
  robots_disallow: z.array(z.string()),
  locales: z.object({ en: seoLocaleSiteSchema, ar: seoLocaleSiteSchema }),
  updated_at: z.iso.datetime({ offset: true }).nullable(),
});

/** What the website reads for one language: site settings plus every saved page override, by key. */
export const seoBundleSchema = z.object({
  site: seoSiteSchema,
  pages: z.record(z.string(), seoPageSchema),
});

export type SeoChangeFrequency = z.infer<typeof seoChangeFrequencySchema>;
export type SeoPage = z.infer<typeof seoPageSchema>;
export type SeoSite = z.infer<typeof seoSiteSchema>;
export type SeoBundle = z.infer<typeof seoBundleSchema>;

export const emptySeoSite = (): SeoSite => ({
  title_template: null,
  default_og_image: null,
  twitter_site: null,
  organization: { name: null, legal_name: null, logo: null, email: null, phone: null, same_as: [] },
  verification: { google: null, bing: null, yandex: null, pinterest: null },
  indexing: true,
  robots_disallow: [],
  locales: {
    en: { site_name: null, default_title: null, default_description: null, keywords: [] },
    ar: { site_name: null, default_title: null, default_description: null, keywords: [] },
  },
  updated_at: null,
});
