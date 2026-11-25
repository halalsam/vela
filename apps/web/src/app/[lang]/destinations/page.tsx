import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DestinationIndex } from '@/components/sections/destinations/DestinationIndex';
import { Container } from '@/components/ui';
import { loadCatalog, summarizeCountry, summarizeRegion } from '@/lib/destinations';
import { isLocale } from '@/lib/i18n';
import { JsonLd } from '@/components/sections/JsonLd';
import { breadcrumbLd, extraLd, itemListLd, pageMetadata, resolvePageSeo, webPageLd } from '@/lib/seo';
import { getDictionary } from '../dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return pageMetadata({ key: 'destinations', locale: lang, path: '/destinations' });
}

export default async function DestinationsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, { countries, regions }, seo] = await Promise.all([
    getDictionary(lang),
    loadCatalog(),
    resolvePageSeo({ key: 'destinations', locale: lang, path: '/destinations' }),
  ]);
  const all = [...countries.map((country) => summarizeCountry(country, lang)), ...regions.map((region) => summarizeRegion(region, lang))];
  const structured = [
    webPageLd(seo, lang, '/destinations', 'CollectionPage'),
    breadcrumbLd([
      { name: dict.blog.home, href: `/${lang}` },
      { name: seo.title, href: `/${lang}/destinations` },
    ]),
    itemListLd(all.map((item) => ({ name: item.name, href: `/${lang}/destinations/${item.slug}` }))),
    ...extraLd(seo),
  ];
  return (
    <Container className="pb-10">
      <JsonLd data={structured} />
      <DestinationIndex
        locale={lang}
        labels={dict.destinations}
        destinationLabels={dict.destination}
        countries={countries.map((country) => summarizeCountry(country, lang))}
        regions={regions.map((region) => summarizeRegion(region, lang))}
      />
    </Container>
  );
}
