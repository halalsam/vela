import { notFound } from 'next/navigation';
import { AppBand, Hero, HomeFaq, HowItWorks, OffersRow, PopularGrid, RegionsRow } from '@/components/sections/home/HomeSections';
import { helpFor } from '@/lib/help';
import { serverApi } from '@/lib/api';
import { loadCatalog, summarizeCountry, summarizeRegion } from '@/lib/destinations';
import { isLocale } from '@/lib/i18n';
import { getDictionary } from './dictionaries';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, { countries, regions }, offers] = await Promise.all([getDictionary(lang), loadCatalog(), serverApi.getOffers()]);
  const countrySummaries = countries.map((country) => summarizeCountry(country, lang));
  const regionSummaries = regions.map((region) => summarizeRegion(region, lang));
  const faq = helpFor(lang).faq;
  const popular = countries.filter((country) => country.popular).map((country) => summarizeCountry(country, lang));

  return (
    <>
      <Hero locale={lang} dict={dict} destinations={[...countrySummaries, ...regionSummaries]} picks={popular.slice(0, 5)} />
      <PopularGrid locale={lang} dict={dict} destinations={popular} />
      <RegionsRow locale={lang} dict={dict} regions={regionSummaries} />
      <OffersRow locale={lang} dict={dict} offers={offers} />
      <HowItWorks dict={dict} />
      <HomeFaq locale={lang} dict={dict} title={faq.title} items={faq.groups.flatMap((group) => group.items.slice(0, 2)).slice(0, 6)} />
      <AppBand dict={dict} />
    </>
  );
}
