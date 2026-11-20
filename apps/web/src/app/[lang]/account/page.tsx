import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccountView } from '@/components/sections/account/AccountView';
import { Container } from '@/components/ui';
import { loadCatalog } from '@/lib/destinations';
import { isLocale, localized } from '@/lib/i18n';
import { getDictionary } from '../dictionaries';

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountPage({ params }: PageProps<'/[lang]/account'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, { countries, regions }] = await Promise.all([getDictionary(lang), loadCatalog()]);
  const names = Object.fromEntries([
    ...countries.map((country) => [country.code, localized(country.name, lang)]),
    ...regions.map((region) => [region.id, localized(region.name, lang)]),
  ]);
  return (
    <Container className="py-10 md:py-16">
      <AccountView locale={lang} labels={dict.account} names={names} />
    </Container>
  );
}
