import { emptySeoSite, seoSiteSchema, type BlogLocale, type SeoBundle, type SeoPage, type SeoSite } from '@vela/api';
import type { Database } from '../db/client';
import { audit } from '../models/audit.model';
import * as content from '../models/content.model';
import { pageOut } from '../views/seo.view';

export const SEO_KEY_PATTERN = /^[a-z][a-z0-9-]*(?::[a-z0-9-]+)?$/;
const SITE_ID = 'site';

export type SeoPageInput = Omit<SeoPage, 'key' | 'locale' | 'updated_at'>;
export type SeoSiteInput = Omit<SeoSite, 'updated_at'>;

// Stored settings are merged over the empty defaults, so fields added later read as "not set" instead of failing.
export async function siteSettings(db: Database): Promise<SeoSite> {
  const row = await content.findSetting(db, SITE_ID);
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
  const [site, rows] = await Promise.all([siteSettings(db), content.seoPagesFor(db, locale)]);
  return { site, pages: Object.fromEntries(rows.map((row) => [row.key, pageOut(row)])) };
}

export async function listSeoPages(db: Database) {
  return (await content.allSeoPages(db)).map(pageOut);
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
  const row = await content.upsertSeoPage(db, key, locale, set);
  await audit(db, actorId, 'seo.page.save', `seo:${key}:${locale}`, { noindex: input.noindex });
  return pageOut(row);
}

export async function resetSeoPage(db: Database, actorId: string, key: string, locale: BlogLocale) {
  await content.deleteSeoPage(db, key, locale);
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
  await content.saveSetting(db, SITE_ID, value, actorId);
  await audit(db, actorId, 'seo.site.save', 'seo:site', { indexing: input.indexing });
  return siteSettings(db);
}
