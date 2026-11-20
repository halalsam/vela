import type { Offer } from '@vela/api';
import Link from 'next/link';
import { Flag, FlagStack, UsageRing } from '@/components/esim';
import { Button, Card, Container, Pill, SectionTitle, cardLink } from '@/components/ui';
import type { DestinationSummary } from '@/lib/destinations';
import { format, localized, plural, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { MarkLockup } from '../Mark';
import { DestinationSearch } from './DestinationSearch';

export function Hero({ locale, dict, destinations }: { locale: Locale; dict: Dictionary; destinations: DestinationSummary[] }) {
  return (
    <Container className="grid items-center gap-12 pb-16 pt-12 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
      <div className="flex flex-col gap-7">
        <MarkLockup className="w-40 text-fg" />
        <h1 className={type.hero}>{dict.hero.title}</h1>
        <p className={cn(type.body, 'max-w-md text-fg-secondary')}>{dict.hero.body}</p>
        <DestinationSearch
          locale={locale}
          destinations={destinations}
          label={dict.hero.searchLabel}
          placeholder={dict.hero.searchPlaceholder}
          noResults={dict.hero.noResults}
        />
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {dict.hero.points.map((point) => (
            <li key={point} className={cn(type.callout, 'flex items-center gap-2 text-fg-secondary')}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <HeroCard name={destinations.find((item) => item.slug === 'jp')?.name ?? 'Japan'} active={dict.account.active} />
    </Container>
  );
}

function HeroCard({ name, active }: { name: string; active: string }) {
  return (
    <div aria-hidden className="relative hidden md:block">
      <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle_at_70%_20%,rgba(200,178,133,0.18),transparent_60%)]" />
      <Card className="relative mx-auto flex max-w-sm flex-col gap-6 p-section motion-safe:animate-rise">
        <div className="flex items-center gap-3">
          <Flag code="JP" size="lg" />
          <div className="flex-1">
            <p className={type.title}>{name} · 10 GB</p>
            <p className={cn(type.caption, 'text-fg-tertiary')}>NTT Docomo · 5G</p>
          </div>
          <Pill tone="success">{active}</Pill>
        </div>
        <div className="flex items-center gap-5">
          <UsageRing fraction={0.38} label="" />
          <div>
            <p className={type.dataLg}>3.8 GB</p>
            <p className={cn(type.caption, 'text-fg-tertiary')}>6d 14h</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function PopularGrid({ locale, dict, destinations }: { locale: Locale; dict: Dictionary; destinations: DestinationSummary[] }) {
  return (
    <Container className="flex flex-col gap-5 py-10">
      <SectionTitle id="destinations">{dict.home.popular}</SectionTitle>
      <ul className="grid grid-cols-2 gap-card-gap sm:grid-cols-3 lg:grid-cols-6">
        {destinations.map((item, index) => (
          <li key={item.slug} className={cn('motion-safe:animate-rise', index > 0 && `rise-${Math.min(index, 3)}`)}>
            <Link href={`/${locale}/destinations/${item.slug}`} className={cn(cardLink, 'flex h-full flex-col gap-5 p-gutter')}>
              <Flag code={item.codes[0] ?? ''} size="xl" />
              <span className="flex flex-col gap-0.5">
                <span className={type.bodyStrong}>{item.name}</span>
                <span className={cn(type.caption, 'text-fg-tertiary')}>{format(dict.destination.from, { price: item.from })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

export function RegionsRow({ locale, dict, regions }: { locale: Locale; dict: Dictionary; regions: DestinationSummary[] }) {
  return (
    <Container className="flex flex-col gap-5 py-10">
      <SectionTitle>{dict.home.regions}</SectionTitle>
      <ul className="grid gap-card-gap sm:grid-cols-2 lg:grid-cols-4">
        {regions.map((item) => (
          <li key={item.slug}>
            <Link href={`/${locale}/destinations/${item.slug}`} className={cn(cardLink, 'flex h-full flex-col gap-6 p-section')}>
              <FlagStack codes={item.codes} size="lg" max={4} />
              <span className="flex flex-col gap-1">
                <span className={type.displayMd}>{item.name}</span>
                <span className={cn(type.caption, 'text-fg-tertiary')}>
                  {plural(dict.destination as unknown as Record<string, string>, 'countries', item.codes.length, locale)} ·{' '}
                  {format(dict.destination.from, { price: item.from })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

export function OffersRow({ locale, dict, offers }: { locale: Locale; dict: Dictionary; offers: Offer[] }) {
  return (
    <Container className="flex flex-col gap-5 py-10">
      <SectionTitle>{dict.home.offers}</SectionTitle>
      <ul className="grid gap-card-gap md:grid-cols-3">
        {offers.map((offer) => (
          <li key={offer.id}>
            <Card className="relative flex h-full flex-col gap-4 overflow-hidden bg-surface-2 p-section">
              <div aria-hidden className="absolute -end-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(200,178,133,0.25),transparent_65%)]" />
              <Pill tone="accent" caps className="self-start">
                {localized(offer.tag, locale)}
              </Pill>
              <h3 className={type.displayMd}>{localized(offer.title, locale)}</h3>
              <p className={cn(type.callout, 'text-fg-secondary')}>{localized(offer.body, locale)}</p>
              {offer.code ? <p className={cn(type.labelSm, 'mt-auto text-accent')}>{offer.code}</p> : null}
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  );
}

export function HowItWorks({ dict }: { dict: Dictionary }) {
  return (
    <Container className="flex flex-col gap-8 py-16">
      <h2 id="how" className={type.displayLg}>
        {dict.home.howTitle}
      </h2>
      <ol className="grid gap-card-gap md:grid-cols-3">
        {dict.home.steps.map((step, index) => (
          <li key={step.title}>
            <Card className="flex h-full flex-col gap-4 p-section">
              <span className={cn(type.dataSm, 'flex h-11 w-11 items-center justify-center rounded-pill bg-fg text-fg-inverse')}>{index + 1}</span>
              <h3 className={type.title}>{step.title}</h3>
              <p className={cn(type.callout, 'text-fg-secondary')}>{step.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Container>
  );
}

export function AppBand({ dict }: { dict: Dictionary }) {
  return (
    <Container className="py-10">
      <Card className="flex flex-col gap-6 overflow-hidden bg-surface-2 p-8 md:flex-row md:items-center md:justify-between md:p-12">
        <div id="app" className="flex max-w-lg flex-col gap-3">
          <h2 className={type.displayLg}>{dict.home.appTitle}</h2>
          <p className={cn(type.body, 'text-fg-secondary')}>{dict.home.appBody}</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Button disabled aria-describedby="app-soon">
              {dict.home.ios}
            </Button>
            <Button variant="secondary" disabled aria-describedby="app-soon">
              {dict.home.android}
            </Button>
          </div>
          <p id="app-soon" className={cn(type.caption, 'text-fg-tertiary')}>
            {dict.home.appSoon}
          </p>
        </div>
      </Card>
    </Container>
  );
}
