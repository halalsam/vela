import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n';
import { loadSite } from '@/lib/seo';
import { siteUrl } from '@/lib/site';

export const revalidate = 300;

const privatePaths = ['/checkout', '/success', '/account'];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await loadSite();
  // Site-wide indexing off (staging, pre-launch): block everything.
  if (!site.indexing) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...locales.flatMap((locale) => privatePaths.map((path) => `/${locale}${path}`)), '/admin', ...site.robots_disallow],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
