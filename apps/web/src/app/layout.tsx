import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { brandName, tagline } from '@vela/brand';
import { colors } from '@vela/tokens';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brandName} — ${tagline}`,
    template: `%s · ${brandName}`,
  },
  description: 'Travel eSIM data plans. Buy before you fly, land connected, top up anytime.',
  applicationName: brandName,
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: brandName,
    title: `${brandName} — ${tagline}`,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: brandName }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: colors.canvas.DEFAULT,
  colorScheme: 'dark',
};

const preloadFonts = ['Manrope-Regular', 'Manrope-SemiBold', 'InstrumentSerif-Regular'];

export default function RootLayout({ children }: { children: ReactNode }) {
  for (const font of preloadFonts) {
    preload(`/fonts/${font}.ttf`, { as: 'font', type: 'font/ttf', crossOrigin: 'anonymous' });
  }
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
