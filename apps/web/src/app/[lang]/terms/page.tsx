import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/sections/LegalPage';
import { isLocale } from '@/lib/i18n';
import { termsFor } from '@/lib/legal';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const doc = termsFor(lang);
  return { title: doc.title, description: doc.description, alternates: { canonical: `/${lang}/terms`, languages: { en: '/en/terms', ar: '/ar/terms' } } };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalPage doc={termsFor(lang)} />;
}
