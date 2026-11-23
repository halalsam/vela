import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/sections/LegalPage';
import { isLocale } from '@/lib/i18n';
import { privacyFor } from '@/lib/legal';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const doc = privacyFor(lang);
  return { title: doc.title, description: doc.description, alternates: { canonical: `/${lang}/privacy`, languages: { en: '/en/privacy', ar: '/ar/privacy' } } };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPage doc={privacyFor(lang)} />;
}
