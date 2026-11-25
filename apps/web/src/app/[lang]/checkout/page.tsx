import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatData } from '@vela/utils';
import { CheckoutForm } from '@/components/sections/checkout/CheckoutForm';
import { ButtonLink, Container } from '@/components/ui';
import { serverApi } from '@/lib/api';
import { loadCatalog } from '@/lib/destinations';
import { isLocale, localized, plural } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { getDictionary } from '../dictionaries';

export const metadata: Metadata = { robots: { index: false } };

export default async function CheckoutPage({ params, searchParams }: PageProps<'/[lang]/checkout'>) {
  const { lang } = await params;
  const { plan: planParam } = await searchParams;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const planId = typeof planParam === 'string' ? planParam : '';
  const plan = planId ? await serverApi.getPlan(planId).catch(() => null) : null;

  if (!plan) {
    return (
      <Container className="flex flex-col items-start gap-6 py-20">
        <h1 className={type.displayXl}>{dict.checkout.title}</h1>
        <p className={cn(type.body, 'text-fg-secondary')}>{dict.checkout.notFound}</p>
        <ButtonLink href={`/${lang}/destinations`}>{dict.nav.destinations}</ButtonLink>
      </Container>
    );
  }

  const { countries, regions } = await loadCatalog();
  const regionId = plan.id.split('-')[0];
  const region = plan.type === 'country' ? null : regions.find((item) => item.id === regionId);
  const country = countries.find((item) => item.code === plan.country_codes[0]);
  const name = region ? localized(region.name, lang) : country ? localized(country.name, lang) : plan.country_codes[0] ?? '';

  return (
    <Container className="flex flex-col gap-8 py-10 md:py-16">
      <h1 className={type.displayXl}>{dict.checkout.title}</h1>
      <CheckoutForm
        successBase={`/${lang}/success`}
        accountHref={`/${lang}/account`}
        labels={dict.checkout}
        plan={{
          id: plan.id,
          title: `${name} · ${formatData(plan.data_mb)}`,
          days: plural(dict.destination as unknown as Record<string, string>, 'days', plan.validity_days, lang),
          price: plan.price,
          currency: plan.currency,
          codes: plan.country_codes,
          isRegion: plan.type !== 'country',
        }}
      />
    </Container>
  );
}
