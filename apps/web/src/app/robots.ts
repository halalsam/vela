import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/en/checkout', '/ar/checkout', '/en/success', '/ar/success', '/en/account', '/ar/account', '/admin'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
