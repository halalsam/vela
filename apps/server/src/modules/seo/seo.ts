import { emptySeoSite, seoSiteSchema, type BlogLocale, type SeoBundle, type SeoChangeFrequency, type SeoPage, type SeoSite } from '@vela/api';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { seoPage, seoSetting } from '../../db/schema';
import { audit } from '../admin/admin';

type Row = typeof seoPage.$inferSelect;

export const SEO_KEY_PATTERN = /^[a-z][a-z0-9-]*(?::[a-z0-9-]+)?$/;
const SITE_ID = 'site';

export type SeoPageInput = Omit<SeoPage, 'key' | 'locale' | 'updated_at'>;
export type SeoSiteInput = Omit<SeoSite, 'updated_at'>;

function pageOut(row: Row): SeoPage {
  return {
    key: row.key,
    locale: row.locale,
    meta_title: row.metaTitle,
    meta_description: row.metaDescription,
    keywords: row.keywords,
    og_title: row.ogTitle,
    og_description: row.ogDescription,
    og_image: row.ogImage,
    og_image_alt: row.ogImageAlt,
    canonical_url: row.canonicalUrl,
    noindex: row.noindex,
    nofollow: row.nofollow,
    sitemap_priority: row.sitemapPriority,
    change_frequency: (row.changeFrequency as SeoChangeFrequency | null) ?? null,
    structured_data: row.structuredData,
    updated_at: row.updatedAt.toISOString(),
  };
}

// Stored settings are merged over the empty defaults, so fields added later read as "not set" instead of failing.
export async function siteSettings(db: Database): Promise<SeoSite> {
  const [row] = await db.select().from(seoSetting).where(eq(seoSetting.id, SITE_ID));
  const base = emptySeoSite();
  if (!row) return base;
  const stored = (row.value ?? {}) as Partial<SeoSite>;
  const merged = {
    ...base,
    ...stored,
    organization: { ...base.organization, ...stored.organization },
    verification: { ...base.verification, ...stored.verification },
    locales: { en: { ...base.locales.en, ...stored.locales?.en }, ar: { ...base.locales.ar, ...stored.locales?.ar } },
    updated_at: row.updatedAt.toISOString(),
  };
  const parsed = seoSiteSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

export async function seoBundle(db: Database, locale: BlogLocale): Promise<SeoBundle> {
  const [site, rows] = await Promise.all([siteSettings(db), db.select().from(seoPage).where(eq(seoPage.locale, locale))]);
  return { site, pages: Object.fromEntries(rows.map((row) => [row.key, pageOut(row)])) };
}

export async function listSeoPages(db: Database) {
  const rows = await db.select().from(seoPage).orderBy(asc(seoPage.key), asc(seoPage.locale));
  return rows.map(pageOut);
}

const clean = (list: string[], lower = false) => [...new Set(list.map((item) => (lower ? item.trim().toLowerCase() : item.trim())).filter(Boolean))];

export async function saveSeoPage(db: Database, actorId: string, key: string, locale: BlogLocale, input: SeoPageInput) {
  const set = {
    metaTitle: input.meta_title,
    metaDescription: input.meta_description,
    keywords: clean(input.keywords, true),
    ogTitle: input.og_title,
    ogDescription: input.og_description,
    ogImage: input.og_image,
    ogImageAlt: input.og_image_alt,
    canonicalUrl: input.canonical_url,
    noindex: input.noindex,
    nofollow: input.nofollow,
    sitemapPriority: input.sitemap_priority,
    changeFrequency: input.change_frequency,
    structuredData: input.structured_data,
    updatedBy: actorId,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(seoPage)
    .values({ key, locale, ...set })
    .onConflictDoUpdate({ target: [seoPage.key, seoPage.locale], set })
    .returning();
  await audit(db, actorId, 'seo.page.save', `seo:${key}:${locale}`, { noindex: input.noindex });
  return pageOut(row!);
}

export async function resetSeoPage(db: Database, actorId: string, key: string, locale: BlogLocale) {
  await db.delete(seoPage).where(and(eq(seoPage.key, key), eq(seoPage.locale, locale)));
  await audit(db, actorId, 'seo.page.reset', `seo:${key}:${locale}`);
}

export async function saveSiteSettings(db: Database, actorId: string, input: SeoSiteInput) {
  const value = {
    ...input,
    organization: { ...input.organization, same_as: clean(input.organization.same_as) },
    robots_disallow: clean(input.robots_disallow),
    locales: {
      en: { ...input.locales.en, keywords: clean(input.locales.en.keywords, true) },
      ar: { ...input.locales.ar, keywords: clean(input.locales.ar.keywords, true) },
    },
  };
  await db
    .insert(seoSetting)
    .values({ id: SITE_ID, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: seoSetting.id, set: { value, updatedBy: actorId, updatedAt: new Date() } });
  await audit(db, actorId, 'seo.site.save', 'seo:site', { indexing: input.indexing });
  return siteSettings(db);
}
