import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DestinationIndex } from '@/components/sections/destinations/DestinationIndex';
import { Container } from '@/components/ui';
import { loadCatalog, summarizeCountry, summarizeRegion } from '@/lib/destinations';
import { isLocale } from '@/lib/i18n';
import { getDictionary } from '../dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.destinations.metaTitle,
    description: dict.destinations.metaDescription,
    alternates: {
      canonical: `/${lang}/destinations`,
      languages: { en: '/en/destinations', ar: '/ar/destinations' },
    },
  };
}

export default async function DestinationsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, { countries, regions }] = await Promise.all([getDictionary(lang), loadCatalog()]);
  return (
    <Container className="pb-10">
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
