import type { SeoChangeFrequency, SeoPage } from '@vela/api';
import type { SeoPageRow as Row } from '../models/content.model';

export function pageOut(row: Row): SeoPage {
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
