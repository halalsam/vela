import { readingMinutes, type BlogPost, type BlogPostSummary } from '@vela/api';
import type { BlogPostRow as Row } from '../models/content.model';

export function summaryOut(row: Row): BlogPostSummary {
  return {
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    excerpt: row.excerpt,
    cover_image: row.coverImage,
    cover_alt: row.coverAlt,
    author: { name: row.authorName, role: row.authorRole },
    tags: row.tags,
    country_codes: row.countryCodes,
    reading_minutes: readingMinutes(row.body, row.locale),
    published_at: (row.publishedAt ?? row.createdAt).toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function postOut(row: Row): BlogPost {
  return {
    ...summaryOut(row),
    body: row.body,
    alternate_slug: row.alternateSlug,
    seo: {
      meta_title: row.metaTitle,
      meta_description: row.metaDescription,
      canonical_url: row.canonicalUrl,
      og_image: row.ogImage,
      keywords: row.keywords,
      noindex: row.noindex,
    },
  };
}

export function adminPostOut(row: Row) {
  return {
    id: row.id,
    ...postOut(row),
    status: row.status,
    published_at: row.publishedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}
