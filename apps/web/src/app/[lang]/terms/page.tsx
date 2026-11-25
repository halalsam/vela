import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalView } from '@/components/sections/InfoPages';
import { JsonLd } from '@/components/sections/JsonLd';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { legalDocFor } from '@/lib/legal';
import { isLocale } from '@/lib/i18n';
import { breadcrumbLd, extraLd, pageMetadata, resolvePageSeo, webPageLd } from '@/lib/seo';

const key = 'terms';
const path = '/terms';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return pageMetadata({ key, locale: lang, path });
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, seo] = await Promise.all([getDictionary(lang), resolvePageSeo({ key, locale: lang, path })]);
  const structured = [
    webPageLd(seo, lang, path, 'WebPage'),
    breadcrumbLd([
      { name: dict.blog.home, href: `/${lang}` },
      { name: legalDocFor('terms', lang).title, href: `/${lang}${path}` },
    ]),
    ...extraLd(seo),
  ];
  return (
    <>
      <JsonLd data={structured} />
      <LegalView doc={legalDocFor('terms', lang)} slug="terms" locale={lang} footer={dict.footer} />
    </>
  );
}
