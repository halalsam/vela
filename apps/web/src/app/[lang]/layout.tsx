import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { preload } from 'react-dom';
import { brandName } from '@vela/brand';
import { colors } from '@vela/tokens';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { NavigationProgress } from '@/components/sections/NavigationProgress';
import { SiteHeader } from '@/components/sections/SiteHeader';
import { dirFor, isLocale, locales } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { getDictionary } from './dictionaries';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    metadataBase: new URL(siteUrl),
    title: { default: dict.meta.title, template: `%s · ${brandName}` },
    description: dict.meta.description,
    applicationName: brandName,
    manifest: '/site.webmanifest',
    alternates: { canonical: `/${lang}`, languages: { en: '/en', ar: '/ar' } },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
    openGraph: {
      type: 'website',
      siteName: brandName,
      locale: lang === 'ar' ? 'ar_AE' : 'en_IN',
      title: dict.meta.title,
      description: dict.meta.description,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: brandName }],
    },
    twitter: { card: 'summary_large_image', images: ['/og.png'] },
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
          className="sr-only rounded-pill bg-fg px-4 py-2 text-fg-inverse focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
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
