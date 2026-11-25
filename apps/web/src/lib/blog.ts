import type { BlogPost, BlogPostSummary } from '@vela/api';
import { brandName } from '@vela/brand';
import { serverApi } from './api';
import { blogPath } from './blogFormat';
import type { Locale } from './i18n';
import { siteUrl } from './site';

export type { BlogPost, BlogPostSummary };
export { blogPath, formatDate, headingId, outline } from './blogFormat';

/** Published posts, newest first. An unreachable API gives an empty list, so the page still renders. */
export async function loadPosts(locale: Locale): Promise<BlogPostSummary[]> {
  try {
    return await serverApi.getBlogPosts(locale);
  } catch {
    return [];
  }
}

export async function loadPost(locale: Locale, slug: string): Promise<BlogPost | null> {
  try {
    return await serverApi.getBlogPost(locale, slug);
  } catch {
    return null;
  }
}

export const absolute = (href: string) => (/^https?:\/\//.test(href) ? href : `${siteUrl}${href.startsWith('/') ? '' : '/'}${href}`);

/** Social image: the SEO override, then the cover, then the generated card (English only; satori can't shape Arabic). */
export function socialImage(post: BlogPost): string {
  if (post.seo.og_image) return post.seo.og_image;
  if (post.cover_image) return post.cover_image;
  return post.locale === 'en' ? `${blogPath(post.locale, post.slug)}/card` : '/og.png';
}

type JsonLd = Record<string, unknown>;

const organization = (): JsonLd => ({
  '@type': 'Organization',
  name: brandName,
  url: siteUrl,
  logo: { '@type': 'ImageObject', url: `${siteUrl}/icon-512.png`, width: 512, height: 512 },
});

export function breadcrumbLd(items: { name: string; href: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.href) })),
  };
}

export function postLd(post: BlogPost): JsonLd {
  const url = absolute(blogPath(post.locale, post.slug));
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': post.seo.canonical_url ?? url },
    url,
    headline: (post.seo.meta_title ?? post.title).slice(0, 110),
    description: post.seo.meta_description ?? post.excerpt,
    image: [absolute(socialImage(post))],
    datePublished: post.published_at,
    dateModified: post.updated_at,
    inLanguage: post.locale,
    author: { '@type': 'Organization', name: post.author.name, url: siteUrl },
    publisher: organization(),
    keywords: post.seo.keywords.length > 0 ? post.seo.keywords.join(', ') : post.tags.join(', ') || undefined,
    articleSection: post.tags[0],
    wordCount: post.body.split(/\s+/).filter(Boolean).length,
    timeRequired: `PT${post.reading_minutes}M`,
  };
}

export function blogLd(locale: Locale, title: string, description: string, posts: BlogPostSummary[]): JsonLd {
  const url = absolute(blogPath(locale));
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': url,
    url,
    name: title,
    description,
    inLanguage: locale,
    publisher: organization(),
    blogPost: posts.slice(0, 20).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: absolute(blogPath(locale, post.slug)),
      datePublished: post.published_at,
      dateModified: post.updated_at,
      ...(post.cover_image ? { image: absolute(post.cover_image) } : {}),
    })),
  };
}

/** Serialises JSON-LD for a <script> tag. Escapes "<" so post text can't close the tag. */
export function ldJson(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
