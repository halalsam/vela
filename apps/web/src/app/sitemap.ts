import type { MetadataRoute } from 'next';
import { loadPosts } from '@/lib/blog';
import { allDestinationSlugs, loadCatalog } from '@/lib/destinations';
import { locales, type Locale } from '@/lib/i18n';
import { loadSeo } from '@/lib/seo';
import { resolveSeo, seoPageDefs } from '@/lib/seoCore';
import { siteUrl } from '@/lib/site';

export const revalidate = 300;

type Entry = { key: string; itemKey?: string; path: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ countries, regions }, bundles, postLists] = await Promise.all([
    loadCatalog(),
    Promise.all(locales.map((locale) => loadSeo(locale))),
    Promise.all(locales.map((locale) => loadPosts(locale))),
  ]);
  if (!bundles[0]?.site.indexing) return [];

  const entries: Entry[] = [
    ...seoPageDefs.filter((def) => def.key !== 'destination').map((def) => ({ key: def.key, path: def.path })),
    ...allDestinationSlugs(countries, regions).map((slug) => ({ key: 'destination', itemKey: `destination:${slug}`, path: `/destinations/${slug}` })),
  ];

  // Pages hidden from search, or whose canonical points elsewhere, stay out. Priority and frequency come from the admin.
  const pages: MetadataRoute.Sitemap = entries.flatMap((entry) =>
    locales.flatMap((locale: Locale, index) => {
      const bundle = bundles[index]!;
      const page = bundle.pages[entry.key];
      const item = entry.itemKey ? bundle.pages[entry.itemKey] : null;
      const seo = resolveSeo({ locale, site: bundle.site, page, item, def: seoPageDefs.find((def) => def.key === entry.key), defaults: { title: '', description: '' } });
      if (seo.noindex || seo.canonical) return [];
      if (entry.key === 'blog' && (postLists[index] ?? []).length === 0) return [];
      const updated = [item?.updated_at, page?.updated_at].filter(Boolean).sort().at(-1);
      return [
        {
          url: `${siteUrl}/${locale}${entry.path}`,
          ...(updated ? { lastModified: updated } : {}),
          changeFrequency: seo.changeFrequency,
          priority: seo.priority,
          alternates: { languages: { ...Object.fromEntries(locales.map((other) => [other, `${siteUrl}/${other}${entry.path}`])), 'x-default': `${siteUrl}/en${entry.path}` } },
        },
      ];
    }),
  );

  // Posts are per language. Only published, live posts are in the feed.
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
