import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { requireUser } from '../auth/middleware';
import { HttpError } from '../lib/errors';
import {
  createCoupon,
  grantCredit,
  listCoupons,
  listOrders,
  ORDER_STATUSES,
  orderDetail,
  recentAudit,
  roleOf,
  staffIssueInvoice,
  staffRefund,
  updateCoupon,
  type AdminDeps,
  type StaffRole,
} from '../modules/admin/admin';
import { createPost, deletePost, getPost, listPosts, SLUG_PATTERN, updatePost } from '../modules/blog/blog';
import { listSeoPages, resetSeoPage, saveSeoPage, saveSiteSettings, SEO_KEY_PATTERN, siteSettings } from '../modules/seo/seo';
import type { AppEnv } from '../types';

type AdminEnv = AppEnv & { Variables: AppEnv['Variables'] & { role: StaffRole } };

const staffOnly = createMiddleware<AdminEnv>(async (c, next) => {
  const role = await roleOf(c.var.deps.db, c.var.user.id);
  if (role === 'customer') throw new HttpError(403, 'forbidden', 'Staff only');
  c.set('role', role);
  await next();
});

const adminOnly = createMiddleware<AdminEnv>(async (c, next) => {
  if (c.var.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admins only');
  await next();
});

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_request', z.prettifyError(result.error));
  return result.data;
}

const currency = z.enum(['INR', 'AED', 'SAR', 'EUR', 'USD']);
const isoDate = z.iso.datetime({ offset: true }).nullable();

const couponBody = z.object({
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

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.startsWith('/') || /^https:\/\//.test(value), 'Use an https:// URL or a path starting with /')
  .nullable();
const textList = (max: number, each: number) => z.array(z.string().trim().min(1).max(each)).max(max);
const slug = z.string().trim().min(3).max(100).regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens');

const blogFields = {
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
const blogPatch = z.object(blogFields).partial();
const blogCreate = z.object({
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
const blank = (value: unknown) =>
  value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === '' && key !== 'cover_alt' ? null : item]))
    : value;

const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);
const seoImage = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.startsWith('/') || /^https:\/\//.test(value), 'Use an https:// URL or a path starting with /')
  .nullable()
  .default(null);
const jsonLd = z
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

const seoPageBody = z.object({
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

const seoLocaleSite = z.object({
  site_name: nullableText(60),
  default_title: nullableText(90),
  default_description: nullableText(320),
  keywords: textList(15, 60).default([]),
});

const seoSiteBody = z.object({
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
const blankDeep = (value: unknown): unknown => {
  if (value === '') return null;
  if (Array.isArray(value)) return value.filter((item) => item !== '').map(blankDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankDeep(item)]));
  return value;
};

const seoTarget = (c: { req: { param: (name: string) => string } }) =>
  parse(z.object({ key: z.string().max(80).regex(SEO_KEY_PATTERN, 'Unknown page key'), locale: z.enum(['en', 'ar']) }), {
    key: c.req.param('key'),
    locale: c.req.param('locale'),
  });

const deps = (c: { var: AdminEnv['Variables'] }): AdminDeps => ({
  db: c.var.deps.db,
  env: c.var.deps.env,
  logger: c.var.logger,
  payments: c.var.deps.payments,
  provider: c.var.deps.esimProvider,
  backupProvider: c.var.deps.backupProvider,
});

export const adminRoutes = new Hono<AdminEnv>()
  .use('/v1/admin/*', requireUser, staffOnly)
  .get('/v1/admin/me', (c) => c.json({ user_id: c.var.user.id, role: c.var.role }))
  .get('/v1/admin/orders', async (c) => {
    const query = parse(
      z.object({
        status: z.enum(ORDER_STATUSES).optional(),
        q: z.string().max(80).optional(),
        before: z.iso.datetime({ offset: true }).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
      c.req.query(),
    );
    return c.json(await listOrders(c.var.deps.db, { ...query, before: query.before ? new Date(query.before) : undefined }));
  })
  .get('/v1/admin/orders/:id', async (c) => c.json(await orderDetail(c.var.deps.db, c.var.deps.env, c.req.param('id'))))
  .post('/v1/admin/orders/:id/refund', adminOnly, async (c) => {
    const body = parse(z.object({ reason: z.string().trim().min(3).max(500) }), await c.req.json().catch(() => null));
    return c.json(await staffRefund(deps(c), c.var.user.id, c.req.param('id'), body.reason));
  })
  .post('/v1/admin/orders/:id/invoice', async (c) => c.json(await staffIssueInvoice(deps(c), c.var.user.id, c.req.param('id'))))
  .get('/v1/admin/coupons', async (c) => c.json(await listCoupons(c.var.deps.db)))
  .post('/v1/admin/coupons', adminOnly, async (c) => {
    const body = parse(couponBody, await c.req.json().catch(() => null));
    return c.json(await createCoupon(c.var.deps.db, c.var.user.id, body), 201);
  })
  .patch('/v1/admin/coupons/:code', adminOnly, async (c) => {
    const body = parse(
      z.object({
        ends_at: isoDate.optional(),
        max_redemptions: z.number().int().positive().nullable().optional(),
        per_user_limit: z.number().int().positive().optional(),
      }),
      await c.req.json().catch(() => null),
    );
    return c.json(await updateCoupon(c.var.deps.db, c.var.user.id, c.req.param('code'), body));
  })
  .post('/v1/admin/users/:id/credit', adminOnly, async (c) => {
    const body = parse(
      z.object({ amount: z.number().min(-100_000).max(100_000), currency, reason: z.string().trim().min(3).max(200) }),
      await c.req.json().catch(() => null),
    );
    await grantCredit(c.var.deps.db, c.var.user.id, c.req.param('id'), body);
    return c.body(null, 204);
  })
  .get('/v1/admin/blog', async (c) => c.json(await listPosts(c.var.deps.db)))
  .post('/v1/admin/blog', async (c) => {
    const body = parse(blogCreate, blank(await c.req.json().catch(() => null)));
    return c.json(await createPost(c.var.deps.db, c.var.user.id, c.var.role, body), 201);
  })
  .get('/v1/admin/blog/:id', async (c) => c.json(await getPost(c.var.deps.db, c.req.param('id'))))
  .patch('/v1/admin/blog/:id', async (c) => {
    const body = parse(blogPatch, blank(await c.req.json().catch(() => null)));
    return c.json(await updatePost(c.var.deps.db, c.var.user.id, c.var.role, c.req.param('id'), body));
  })
  .delete('/v1/admin/blog/:id', adminOnly, async (c) => {
    await deletePost(c.var.deps.db, c.var.user.id, c.req.param('id'));
    return c.body(null, 204);
  })
  .get('/v1/admin/seo', async (c) => {
    const [site, pages] = await Promise.all([siteSettings(c.var.deps.db), listSeoPages(c.var.deps.db)]);
    return c.json({ site, pages });
  })
  .put('/v1/admin/seo/site', adminOnly, async (c) => {
    const body = parse(seoSiteBody, blankDeep(await c.req.json().catch(() => null)));
    return c.json(await saveSiteSettings(c.var.deps.db, c.var.user.id, body));
  })
  .put('/v1/admin/seo/pages/:key/:locale', adminOnly, async (c) => {
    const target = seoTarget(c);
    const body = parse(seoPageBody, blankDeep(await c.req.json().catch(() => null)));
    return c.json(await saveSeoPage(c.var.deps.db, c.var.user.id, target.key, target.locale, body));
  })
  .delete('/v1/admin/seo/pages/:key/:locale', adminOnly, async (c) => {
    const target = seoTarget(c);
    await resetSeoPage(c.var.deps.db, c.var.user.id, target.key, target.locale);
    return c.body(null, 204);
  })
  .get('/v1/admin/audit', async (c) => c.json(await recentAudit(c.var.deps.db, c.req.query('target'))));
