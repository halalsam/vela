import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import { brandName } from '@vela/brand';
import { colors } from '@vela/tokens';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { NavigationProgress } from '@/components/sections/NavigationProgress';
import { SiteHeader } from '@/components/sections/SiteHeader';
import { dirFor, isLocale, locales } from '@/lib/i18n';
import { loadSeo, ogLocale } from '@/lib/seo';
import { DEFAULT_OG_IMAGE, DEFAULT_TITLE_TEMPLATE } from '@/lib/seoCore';
import { siteUrl } from '@/lib/site';
import { getDictionary } from './dictionaries';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [dict, { site }] = await Promise.all([getDictionary(lang), loadSeo(lang)]);
  // Site-wide defaults from the admin, falling back to the dictionary. Pages override these.
  const local = site.locales[lang];
  const siteName = local.site_name ?? brandName;
  const title = local.default_title ?? dict.meta.title;
  const description = local.default_description ?? dict.meta.description;
  const image = site.default_og_image ?? DEFAULT_OG_IMAGE;
  const verify = site.verification;
  const other: Record<string, string> = {};
  if (verify.bing) other['msvalidate.01'] = verify.bing;
  if (verify.pinterest) other['p:domain_verify'] = verify.pinterest;
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: site.title_template ?? DEFAULT_TITLE_TEMPLATE },
    description,
    keywords: local.keywords.length > 0 ? local.keywords : undefined,
    applicationName: siteName,
    manifest: '/site.webmanifest',
    alternates: { canonical: `/${lang}`, languages: { en: '/en', ar: '/ar', 'x-default': '/en' } },
    robots: site.indexing ? undefined : { index: false, follow: false, googleBot: { index: false, follow: false } },
    verification: {
      google: verify.google ?? undefined,
      yandex: verify.yandex ?? undefined,
      other: Object.keys(other).length > 0 ? other : undefined,
    },
    formatDetection: { telephone: false, email: false, address: false },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
    openGraph: {
      type: 'website',
      siteName,
      locale: ogLocale(lang),
      title,
      description,
      images: [{ url: image, ...(site.default_og_image ? {} : { width: 1200, height: 630 }), alt: siteName }],
    },
    twitter: { card: 'summary_large_image', site: site.twitter_site ?? undefined, images: [image] },
  };
}

export const viewport: Viewport = {
  themeColor: colors.canvas.DEFAULT,
  colorScheme: 'dark',
};

const preloadFonts = {
  en: ['Satoshi-Regular', 'Satoshi-Bold', 'CabinetGrotesk-Bold'],
  ar: ['IBMPlexSansArabic-Regular', 'IBMPlexSansArabic-SemiBold', 'IBMPlexSansArabic-Light'],
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  for (const font of preloadFonts[lang]) {
    preload(`/fonts/${font}.ttf`, { as: 'font', type: 'font/ttf', crossOrigin: 'anonymous' });
  }
  return (
    <html lang={lang} dir={dirFor(lang)}>
      <body className="flex min-h-dvh flex-col">
        <NavigationProgress />
        <a
          href="#main"
          className="sr-only rounded-button bg-fg px-4 py-2 text-fg-inverse focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
        >
          {dict.nav.skip}
        </a>
        <SiteHeader locale={lang} dict={dict} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={lang} dict={dict} />
      </body>
    </html>
  );
}
