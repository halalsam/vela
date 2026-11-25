// Server side of page SEO: loads the admin's settings, works out each page's built-in defaults, and turns both into
// Next metadata and JSON-LD. If the API is down, every page still gets its defaults.
import { createHttpApi, createMockApi, emptySeoSite, type SeoBundle, type SeoSite } from '@vela/api';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { helpFor, type Qa } from './help';
import { locales, otherLocale, type Locale } from './i18n';
import { legalDocFor, legalPages, type LegalPageSlug } from './legal';
import { resolveSeo, seoPageDef, type ResolvedSeo, type SeoDefaults } from './seoCore';
import { siteUrl } from './site';

const baseUrl = process.env.VELA_API_URL;
const mock = createMockApi({ latencyMs: 0 });
// Shorter cache than the catalog so admin edits show within a couple of minutes.
const seoApi = baseUrl
  ? createHttpApi({ baseUrl, fallback: mock, fetch: (url, init) => fetch(url, { ...init, next: { revalidate: 120, tags: ['seo'] } }) })
  : mock;

const empty = (): SeoBundle => ({ site: emptySeoSite(), pages: {} });

export const loadSeo = cache(async (locale: Locale): Promise<SeoBundle> => {
  try {
    return await seoApi.getSeo(locale);
  } catch {
    return empty();
  }
});

export const loadSite = async (): Promise<SeoSite> => (await loadSeo('en')).site;

export const ogLocale = (locale: Locale) => (locale === 'ar' ? 'ar_AE' : 'en_IN');
export const absolute = (href: string) => (/^https?:\/\//.test(href) ? href : `${siteUrl}${href.startsWith('/') ? '' : '/'}${href}`);

/** The site's own copy for a page: what shows when nothing is set in the admin. */
export async function pageDefaults(key: string, locale: Locale): Promise<SeoDefaults> {
  const dict = await getDictionary(locale);
  const base = key.startsWith('destination:') ? 'destination' : key;
  switch (base) {
    case 'home':
      return { title: dict.meta.title, description: dict.meta.description };
    case 'destinations':
      return { title: dict.destinations.metaTitle, description: dict.destinations.metaDescription };
    case 'destination':
      return { title: dict.meta.destinationTitle, description: dict.meta.destinationDescription };
    case 'blog':
      return { title: dict.meta.blogTitle, description: dict.meta.blogDescription };
    case 'help':
    case 'faq': {
      const page = helpFor(locale)[base];
      return { title: page.title, description: page.description };
    }
    default:
      if ((legalPages as readonly string[]).includes(base)) {
        const doc = legalDocFor(base as LegalPageSlug, locale);
        return { title: doc.title, description: doc.description };
      }
      return { title: dict.meta.title, description: dict.meta.description };
  }
}

type PageSeoOptions = {
  key: string;
  locale: Locale;
  /** Path after /<locale>, e.g. "/faq". */
  path: string;
  /** Row key for a single item, e.g. "destination:jp". */
  itemKey?: string;
  vars?: Record<string, string>;
  /** Overrides parts of the built-in default (e.g. an image for this item). */
  defaults?: Partial<SeoDefaults>;
};

export const resolvePageSeo = cache(async (options: PageSeoOptions): Promise<ResolvedSeo> => {
  const [bundle, base] = await Promise.all([loadSeo(options.locale), pageDefaults(options.itemKey ?? options.key, options.locale)]);
  return resolveSeo({
    locale: options.locale,
    site: bundle.site,
    page: bundle.pages[options.key],
    item: options.itemKey ? bundle.pages[options.itemKey] : null,
    def: seoPageDef(options.key),
    defaults: { ...base, ...options.defaults },
    vars: options.vars,
  });
});

export function robotsFor(seo: Pick<ResolvedSeo, 'noindex' | 'nofollow'>): Metadata['robots'] {
  const index = !seo.noindex;
  const follow = !seo.nofollow;
  return {
    index,
    follow,
    googleBot: index ? { index, follow, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } : { index, follow },
  };
}

/** Full metadata for a page: title, description, keywords, canonical, hreflang, robots, Open Graph and X cards. */
export async function pageMetadata(options: PageSeoOptions & { ogType?: 'website' | 'article' }): Promise<Metadata> {
  const [seo, site] = await Promise.all([resolvePageSeo(options), loadSite()]);
  const url = `/${options.locale}${options.path}`;
  const image = absolute(seo.image);
  return {
    title: { absolute: seo.fullTitle },
    description: seo.description,
    keywords: seo.keywords.length > 0 ? seo.keywords : undefined,
    alternates: {
      canonical: seo.canonical ?? url,
      languages: { ...Object.fromEntries(locales.map((locale) => [locale, `/${locale}${options.path}`])), 'x-default': `/en${options.path}` },
    },
    robots: robotsFor(seo),
    openGraph: {
      type: options.ogType ?? 'website',
      siteName: seo.siteName,
      locale: ogLocale(options.locale),
      alternateLocale: [ogLocale(otherLocale(options.locale))],
      url,
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: [{ url: image, alt: seo.imageAlt, ...(seo.source.image === 'site' && !site.default_og_image ? { width: 1200, height: 630 } : {}) }],
    },
    twitter: {
      card: 'summary_large_image',
      site: site.twitter_site ?? undefined,
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: [{ url: image, alt: seo.imageAlt }],
    },
  };
}

// JSON-LD.

export type JsonLd = Record<string, unknown>;

export function organizationLd(site: SeoSite, locale: Locale): JsonLd {
  const org = site.organization;
  const contact = org.email || org.phone;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: org.name ?? site.locales[locale].site_name ?? 'vela',
    ...(org.legal_name ? { legalName: org.legal_name } : {}),
    url: siteUrl,
    logo: { '@type': 'ImageObject', url: absolute(org.logo ?? '/icon-512.png'), width: 512, height: 512 },
    ...(org.same_as.length > 0 ? { sameAs: org.same_as } : {}),
    ...(contact
      ? {
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'customer support',
              ...(org.email ? { email: org.email } : {}),
              ...(org.phone ? { telephone: org.phone } : {}),
              availableLanguage: ['English', 'Arabic'],
            },
          ],
        }
      : {}),
  };
}

export function websiteLd(site: SeoSite, locale: Locale, description: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: absolute(`/${locale}`),
    name: site.locales[locale].site_name ?? 'vela',
    description,
    inLanguage: locale,
    publisher: { '@id': `${siteUrl}/#organization` },
  };
}

export function breadcrumbLd(items: { name: string; href: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.href) })),
  };
}

export function faqLd(items: Qa[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  };
}

export function webPageLd(seo: ResolvedSeo, locale: Locale, path: string, type = 'WebPage'): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': absolute(`/${locale}${path}`),
    url: absolute(`/${locale}${path}`),
    name: seo.title,
    description: seo.description,
    inLanguage: locale,
    isPartOf: { '@id': `${siteUrl}/#website` },
    primaryImageOfPage: { '@type': 'ImageObject', url: absolute(seo.image) },
  };
}

export function itemListLd(items: { name: string; href: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: absolute(item.href) })),
  };
}

/** Admin-supplied JSON-LD. Anything that doesn't parse is dropped, so a typo can't break the page. */
export function extraLd(seo: ResolvedSeo): JsonLd[] {
  return seo.structuredData.flatMap((raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.filter((item): item is JsonLd => typeof item === 'object' && item !== null).map((item) => ({ '@context': 'https://schema.org', ...item }));
    } catch {
      return [];
    }
  });
}

/** Serialises JSON-LD for a <script> tag. Escapes "<" so page text can't close the tag. */
export function ldJson(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
