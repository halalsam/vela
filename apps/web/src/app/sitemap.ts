import type { MetadataRoute } from 'next';
import { loadPosts } from '@/lib/blog';
import { allDestinationSlugs, loadCatalog } from '@/lib/destinations';
import { locales } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ countries, regions }, ...postLists] = await Promise.all([loadCatalog(), ...locales.map((locale) => loadPosts(locale))]);
  const paths = [
    '',
    '/destinations',
    '/blog',
    '/help',
    '/faq',
    '/contact',
    '/terms',
    '/privacy',
    '/refunds',
    '/delivery',
    '/cookies',
    ...allDestinationSlugs(countries, regions).map((slug) => `/destinations/${slug}`),
  ];
  const pages: MetadataRoute.Sitemap = paths.flatMap((rest) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${rest}`,
      changeFrequency: rest ? ('weekly' as const) : ('daily' as const),
      priority: rest ? 0.8 : 1,
      alternates: { languages: Object.fromEntries(locales.map((other) => [other, `${siteUrl}/${other}${rest}`])) },
    })),
  );
  // Posts are per language. Noindexed posts and posts that point their canonical elsewhere stay out.
  const posts: MetadataRoute.Sitemap = locales.flatMap((locale, index) =>
    (postLists[index] ?? []).map((post) => ({
      url: `${siteUrl}/${locale}/blog/${post.slug}`,
      lastModified: post.updated_at,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      ...(post.cover_image ? { images: [post.cover_image.startsWith('/') ? `${siteUrl}${post.cover_image}` : post.cover_image] } : {}),
    })),
  );
  return [...pages, ...posts];
}
