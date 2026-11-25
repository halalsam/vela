import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpView } from '@/components/sections/InfoPages';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { helpFor } from '@/lib/help';
import { isLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const page = helpFor(lang).help;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${lang}/help`, languages: { en: '/en/help', ar: '/ar/help' } },
  };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <HelpView content={helpFor(lang)} locale={lang} footer={dict.footer} />;
}
