import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { bestValuePlanId, dataParts, formatPrice, pricePerGb } from '@vela/utils';
import { CountryMap, Flag, FlagStack } from '@/components/esim';
import { PlanSelector } from '@/components/sections/destination/PlanSelector';
import { Card, Container, Pill, focusRing } from '@/components/ui';
import { allDestinationSlugs, loadCatalog, loadDestination, type PlanView } from '@/lib/destinations';
import { format, isLocale, locales, localized, plural, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { getDictionary } from '../../dictionaries';

export async function generateStaticParams() {
  const { countries, regions } = await loadCatalog();
  const slugs = allDestinationSlugs(countries, regions);
  return locales.flatMap((lang) => slugs.map((slug) => ({ lang, slug })));
}

async function resolve(lang: string, slug: string) {
  if (!isLocale(lang)) return null;
  const destination = await loadDestination(slug);
  if (!destination) return null;
  const source = destination.country ?? destination.region;
  const name = localized(source.name, lang);
  return { destination, name, locale: lang as Locale };
}

export async function generateMetadata({ params }: PageProps<'/[lang]/destinations/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params;
  const resolved = await resolve(lang, slug);
  if (!resolved) return {};
  const dict = await getDictionary(resolved.locale);
  const from = formatPrice(Math.min(...resolved.destination.plans.map((plan) => plan.price)), 'INR');
  return {
    title: format(dict.meta.destinationTitle, { name: resolved.name, price: from }),
    description: format(dict.meta.destinationDescription, { name: resolved.name }),
    alternates: {
      canonical: `/${lang}/destinations/${slug}`,
      languages: { en: `/en/destinations/${slug}`, ar: `/ar/destinations/${slug}` },
    },
  };
}

export default async function DestinationPage({ params }: PageProps<'/[lang]/destinations/[slug]'>) {
  const { lang, slug } = await params;
  const resolved = await resolve(lang, slug);
  if (!resolved) notFound();
  const { destination, name, locale } = resolved;
  const dict = await getDictionary(locale);
  const plans = destination.plans;
  const best = bestValuePlanId(plans);
  const codes = destination.country ? [destination.country.code] : destination.region.country_codes;
  const group = dict.destination as unknown as Record<string, string>;
  const views: PlanView[] = plans.map((plan) => {
    const data = dataParts(plan.data_mb);
    return {
      id: plan.id,
      data: `${data.value} ${data.unit}`,
      days: plural(group, 'days', plan.validity_days, locale),
      price: formatPrice(plan.price, plan.currency),
      perGb: format(dict.destination.perGb, { price: formatPrice(Math.round(pricePerGb(plan)), plan.currency) }),
      is5g: plan.is_5g,
      hotspot: plan.hotspot,
      best: plan.id === best,
    };
  });
  const networks = [...new Set(plans.flatMap((plan) => plan.networks))];

  return (
    <Container className="grid gap-12 pt-8 md:grid-cols-[0.9fr_1.1fr] md:pt-14">
      <div className="flex flex-col gap-6 md:sticky md:top-24 md:self-start">
        <Link
          href={`/${locale}/destinations`}
          className={cn(type.callout, 'self-start rounded-chip text-fg-secondary hover:text-fg', focusRing)}
        >
          <span aria-hidden className="inline-block rtl:-scale-x-100">
            ←
          </span>{' '}
          {dict.destination.back}
        </Link>
        <div className="relative motion-safe:animate-rise">
          {destination.country ? (
            <CountryMap
              code={codes[0] ?? ''}
              opacity={0.05}
              className="absolute -start-6 -top-6 h-[190px] w-[260px] md:h-[230px] md:w-[320px]"
            />
          ) : null}
          {destination.country ? (
            <Flag code={codes[0] ?? ''} size="hero" className="relative" />
          ) : (
            <FlagStack codes={codes} size="xl" max={5} />
          )}
        </div>
        <h1 className={type.hero}>{name}</h1>
        <p className={cn(type.body, 'text-fg-secondary')}>{dict.destination.dataOnly}</p>
        <div className="flex flex-wrap gap-2">
          {plans.some((plan) => plan.is_5g) ? <Pill>{dict.destination.fiveG}</Pill> : null}
          <Pill>{dict.destination.hotspot}</Pill>
          <Pill tone="accent">{dict.destination.instant}</Pill>
          {destination.region ? <Pill>{plural(group, 'countries', codes.length, locale)}</Pill> : null}
        </div>
      </div>
      <div className="flex flex-col gap-8">
        <PlanSelector
          plans={views}
          source={destination.country ? { kind: 'country', code: destination.country.code } : { kind: 'region', id: destination.region.id }}
          perGbTemplate={dict.destination.perGb}
          checkoutBase={`/${locale}/checkout`}
          labels={{
            plans: dict.destination.plans,
            bestValue: dict.destination.bestValue,
            fiveG: dict.destination.fiveG,
            hotspot: dict.destination.hotspot,
            continue: dict.destination.continue,
          }}
        />
        <Card className="divide-y divide-line">
          <div className="flex flex-col gap-1 p-section">
            <h2 className={type.title}>{dict.destination.networks}</h2>
            <p className={type.body}>{networks.join(' · ')}</p>
          </div>
          <div className="flex flex-col gap-1 p-section">
            <h2 className={type.title}>{dict.destination.compatibleTitle}</h2>
            <p className={cn(type.callout, 'text-fg-secondary')}>{dict.destination.compatibleBody}</p>
          </div>
        </Card>
        <section className="flex flex-col gap-3">
          <h2 className={type.displayMd}>{dict.destination.faqTitle}</h2>
          {dict.destination.faq.map((item) => (
            <details key={item.q} className="group rounded-card border border-line bg-surface-1 px-section py-4 open:bg-surface-2">
              <summary className={cn(type.bodyStrong, 'cursor-pointer list-none rounded-chip', focusRing)}>{item.q}</summary>
              <p className={cn(type.callout, 'mt-3 text-fg-secondary')}>{item.a}</p>
            </details>
          ))}
        </section>
      </div>
    </Container>
  );
}
