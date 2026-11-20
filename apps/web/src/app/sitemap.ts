import type { MetadataRoute } from 'next';
import { allDestinationSlugs, loadCatalog } from '@/lib/destinations';
import { locales } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { countries, regions } = await loadCatalog();
  const paths = ['', ...allDestinationSlugs(countries, regions).map((slug) => `/destinations/${slug}`)];
  return paths.flatMap((rest) =>
    locales.map((locale) => ({
      url: `${siteUrl}/${locale}${rest}`,
      changeFrequency: rest ? ('weekly' as const) : ('daily' as const),
      priority: rest ? 0.8 : 1,
      alternates: { languages: Object.fromEntries(locales.map((other) => [other, `${siteUrl}/${other}${rest}`])) },
    })),
  );
}
