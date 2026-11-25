import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalView } from '@/components/sections/InfoPages';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { isLocale } from '@/lib/i18n';
import { legalDocFor } from '@/lib/legal';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const doc = legalDocFor('cookies', lang);
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/${lang}/cookies`, languages: { en: '/en/cookies', ar: '/ar/cookies' } },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <LegalView doc={legalDocFor('cookies', lang)} slug="cookies" locale={lang} footer={dict.footer} />;
}
