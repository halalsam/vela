import { z } from 'zod';
import { HttpError } from '../lib/errors';
import { ORDER_STATUSES } from '../services/admin.service';
import { SLUG_PATTERN } from '../services/blog.service';
import { ACTIVITIES } from '../services/customers.service';
import { CONVERSATION_STATUSES } from '../services/inbox.service';
import { SEO_KEY_PATTERN } from '../services/seo.service';

/** Request bodies and queries for the admin API. Staff tools post plain JSON, so these run by hand with `parse`. */

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_request', z.prettifyError(result.error));
  return result.data;
}

export const currency = z.enum(['INR', 'AED', 'SAR', 'EUR', 'USD']);
export const isoDate = z.iso.datetime({ offset: true }).nullable();

export const couponBody = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{3,20}$/),
  kind: z.enum(['percent', 'amount']),
  value: z.number().positive(),
  currency: currency.nullable().default(null),
  max_redemptions: z.number().int().positive().nullable().default(null),
  per_user_limit: z.number().int().positive().default(1),
  country_codes: z.array(z.string().regex(/^[A-Za-z]{2}$/)).default([]),
  starts_at: isoDate.default(null),
  ends_at: isoDate.default(null),
});

// https links, site paths, and plain-http localhost (local uploads saved by a dev API).
export const isImageUrl = (value: string) => value.startsWith('/') || /^https:\/\//.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(value);

export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine(isImageUrl, 'Use an https:// URL or a path starting with /')
  .nullable();
export const textList = (max: number, each: number) => z.array(z.string().trim().min(1).max(each)).max(max);
export const slug = z.string().trim().min(3).max(100).regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens');

export const blogFields = {
  locale: z.enum(['en', 'ar']),
  slug,
  title: z.string().trim().min(3).max(140),
  excerpt: z.string().trim().min(10).max(320),
  body: z.string().min(1).max(100_000),
  cover_image: optionalUrl,
  cover_alt: z.string().trim().max(200),
  author_name: z.string().trim().min(1).max(80),
  author_role: z.string().trim().max(80).nullable(),
  tags: textList(8, 32),
  country_codes: z.array(z.string().regex(/^[A-Za-z]{2}$/)).max(30),
  status: z.enum(['draft', 'published']),
  published_at: isoDate,
  alternate_slug: slug.nullable(),
  meta_title: z.string().trim().max(70).nullable(),
  meta_description: z.string().trim().max(200).nullable(),
  canonical_url: z
    .string()
    .trim()
    .max(500)
    .regex(/^https:\/\//, 'Use a full https:// URL')
    .nullable(),
  og_image: optionalUrl,
  keywords: textList(10, 60),
  noindex: z.boolean(),
};

// PATCH sends only what changed, so it has no defaults (zod would fill them in and overwrite saved values).
export const blogPatch = z.object(blogFields).partial();
export const blogCreate = z.object({
  ...blogFields,
  cover_image: blogFields.cover_image.default(null),
  cover_alt: blogFields.cover_alt.default(''),
  author_role: blogFields.author_role.default(null),
  tags: blogFields.tags.default([]),
  country_codes: blogFields.country_codes.default([]),
  status: blogFields.status.default('draft'),
  published_at: blogFields.published_at.default(null),
  alternate_slug: blogFields.alternate_slug.default(null),
  meta_title: blogFields.meta_title.default(null),
  meta_description: blogFields.meta_description.default(null),
  canonical_url: blogFields.canonical_url.default(null),
  og_image: blogFields.og_image.default(null),
  keywords: blogFields.keywords.default([]),
  noindex: blogFields.noindex.default(false),
});

// Empty strings from the editor mean "not set".
export const blank = (value: unknown) =>
  value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === '' && key !== 'cover_alt' ? null : item]))
    : value;

export const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);
export const seoImage = z
  .string()
  .trim()
  .max(500)
  .refine(isImageUrl, 'Use an https:// URL or a path starting with /')
  .nullable()
  .default(null);
export const jsonLd = z
  .string()
  .max(20_000)
  .refine((value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }, 'Structured data must be a JSON object or array')
  .nullable()
  .default(null);

export const seoPageBody = z.object({
  meta_title: nullableText(90),
  meta_description: nullableText(320),
  keywords: textList(15, 60).default([]),
  og_title: nullableText(120),
  og_description: nullableText(320),
  og_image: seoImage,
  og_image_alt: nullableText(200),
  canonical_url: z
    .string()
    .trim()
    .max(500)
    .regex(/^https:\/\//, 'Use a full https:// URL')
    .nullable()
    .default(null),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  sitemap_priority: z.number().min(0).max(1).nullable().default(null),
  change_frequency: z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']).nullable().default(null),
  structured_data: jsonLd,
});

export const seoLocaleSite = z.object({
  site_name: nullableText(60),
  default_title: nullableText(90),
  default_description: nullableText(320),
  keywords: textList(15, 60).default([]),
});

export const seoSiteBody = z.object({
  title_template: z
    .string()
    .trim()
    .max(60)
    .refine((value) => value.includes('%s'), 'The title template needs %s where the page title goes')
    .nullable()
    .default(null),
  default_og_image: seoImage,
  twitter_site: z
    .string()
    .trim()
    .regex(/^@\w{1,15}$/, 'Use an X handle like @vela')
    .nullable()
    .default(null),
  organization: z.object({
    name: nullableText(80),
    legal_name: nullableText(120),
    logo: seoImage,
    email: z.email().nullable().default(null),
    phone: nullableText(30),
    same_as: z.array(z.url({ protocol: /^https$/ })).max(12).default([]),
  }),
  verification: z.object({
    google: nullableText(120),
    bing: nullableText(120),
    yandex: nullableText(120),
    pinterest: nullableText(120),
  }),
  indexing: z.boolean().default(true),
  robots_disallow: z
    .array(z.string().trim().regex(/^\/\S*$/, 'Robots paths start with /').max(200))
    .max(30)
    .default([]),
  locales: z.object({ en: seoLocaleSite, ar: seoLocaleSite }),
});

// Empty strings anywhere in an SEO body mean "not set".
export const blankDeep = (value: unknown): unknown => {
  if (value === '') return null;
  if (Array.isArray(value)) return value.filter((item) => item !== '').map(blankDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankDeep(item)]));
  return value;
};

export const seoTarget = (params: { key: string | undefined; locale: string | undefined }) =>
  parse(z.object({ key: z.string().max(80).regex(SEO_KEY_PATTERN, 'Unknown page key'), locale: z.enum(['en', 'ar']) }), params);

export const iccidValue = z.string().regex(/^\d{19,20}$/, 'Not an ICCID');
export const tagValue = z.string().trim().toLowerCase().max(30);
export const segmentFields = z
  .object({
    q: z.string().trim().max(80).optional(),
    tag: tagValue.optional(),
    language: z.enum(['en', 'ar']).optional(),
    activity: z.enum(ACTIVITIES).optional(),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .strict();
export const withoutBlanks = (value: unknown) =>
  value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '' && item !== null)) : value;
export const segment = z.preprocess(withoutBlanks, segmentFields);

// Query strings send empty values for unset filters.
export const dropEmpty = (value: Record<string, string>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== ''));

export const pushText = (max: number) => z.string().trim().min(1).max(max);
export const broadcastBody = z.object({
  title: pushText(65),
  body: pushText(178),
  title_ar: pushText(65).nullable().default(null),
  body_ar: pushText(178).nullable().default(null),
  segment,
});

export const replyBody = z.object({ title: z.string().trim().min(1).max(60), body: z.string().trim().min(1).max(2000) });


/* Queries and small bodies. */

const before = z.iso.datetime({ offset: true }).optional();
const limit = (fallback: number) => z.coerce.number().int().min(1).max(200).default(fallback);

export const ordersQuery = z.object({ status: z.enum(ORDER_STATUSES).optional(), q: z.string().max(80).optional(), before, limit: limit(50) });
export const refundBody = z.object({ reason: z.string().trim().min(3).max(500) });
export const couponPatch = z.object({
  ends_at: isoDate.optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().optional(),
});
export const creditBody = z.object({ amount: z.number().min(-100_000).max(100_000), currency, reason: z.string().trim().min(3).max(200) });
export const uploadsQuery = z.object({ limit: limit(60), before });
export const conversationsQuery = z.object({
  status: z.enum([...CONVERSATION_STATUSES, 'all']).default('open'),
  assignee: z.enum(['me', 'unassigned', 'any']).default('any'),
  q: z.string().max(80).optional(),
  tag: tagValue.optional(),
  limit: limit(100),
});
export const staffMessageBody = z.object({
  text: z.string().trim().min(1).max(2000),
  internal: z.boolean().default(false),
  status: z.enum(CONVERSATION_STATUSES).optional(),
});
export const conversationPatch = z.object({
  status: z.enum(CONVERSATION_STATUSES).optional(),
  assignee_id: z.string().max(64).nullable().optional(),
  iccid: iccidValue.nullable().optional(),
});
export const startConversationBody = z.object({
  text: z.string().trim().min(1).max(2000),
  internal: z.boolean().default(false),
  iccid: iccidValue.nullable().default(null),
});
export const customersQuery = segmentFields.extend({ before, limit: limit(50) });
export const tagsBody = z.object({ tags: z.array(z.string().max(40)).max(12) });
export const audienceBody = z.object({ segment });

/** Parses an ISO date from a query, if given. */
export const optionalDate = (value: string | undefined) => (value ? new Date(value) : undefined);
