import type { Offer } from '@vela/api';
import Link from 'next/link';
import { CountryMap, Flag, FlagStack } from '@/components/esim';
import { Button, Container, cardLink, focusRing, press } from '@/components/ui';
import type { DestinationSummary } from '@/lib/destinations';
import { localized, plural, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import type { Qa } from '@/lib/help';
import { LocalFrom } from '../LocalFrom';
import { MarkLockup } from '../Mark';
import { Arrow, RegionCard } from '../destinations/cards';
import { CopyCode } from './CopyCode';
import { DestinationSearch } from './DestinationSearch';
import { DottedGlobe } from '../destinations/DottedGlobe';
import { countryCoordinates } from '@/lib/coordinates';

export function Hero({
  locale,
  dict,
  destinations,
  picks,
}: {
  locale: Locale;
  dict: Dictionary;
  destinations: DestinationSummary[];
  /** Popular countries shown as one-tap shortcuts under the search. */
  picks: DestinationSummary[];
}) {
  const title = dict.hero.title;
  const endsWithStop = /[.\u06D4]$/.test(title);
  const pins = destinations.flatMap((item) => {
    const location = item.isRegion ? undefined : countryCoordinates[item.codes[0] ?? ''];
    return location ? [{ location, active: true }] : [];
  });

  return (
    <>
      <section className="relative isolate overflow-hidden md:min-h-[calc(100dvh_-_4rem)]">
        {/* Backdrop: one soft champagne pool behind the globe. Static, decorative. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -bottom-40 end-[-10%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(200,178,133,0.16),transparent_62%)]" />
        </div>

        <Container className="grid items-center gap-14 pb-14 pt-10 md:min-h-[calc(100dvh_-_4rem)] md:grid-cols-[1.08fr_0.92fr] md:gap-10 md:py-16">
          <div className="flex flex-col gap-8">
            <h1
              className={cn(
                'font-display lowercase text-[56px] leading-[54px] tracking-[-0.035em] motion-safe:animate-rise',
                'md:text-[104px] md:leading-[96px] lg:text-[120px] lg:leading-[108px]',
                'rtl:font-arabic-light rtl:normal-case rtl:tracking-normal rtl:text-[46px] rtl:leading-[68px] md:rtl:text-[76px] md:rtl:leading-[108px]',
              )}
            >
              {endsWithStop ? (
                <>
                  {title.slice(0, -1)}
                  <span className="text-accent">{title.slice(-1)}</span>
                </>
              ) : (
                title
              )}
            </h1>
            <p
              className={cn(type.body, 'rise-1 max-w-[26rem] text-fg-secondary motion-safe:animate-rise md:text-[18px] md:leading-[27px]')}
            >
              {dict.hero.body}
            </p>
            <div className="rise-2 flex max-w-xl flex-col gap-4 motion-safe:animate-rise">
              <DestinationSearch
                locale={locale}
                destinations={destinations}
                label={dict.hero.searchLabel}
                placeholder={dict.hero.searchPlaceholder}
                noResults={dict.hero.noResults}
                size="lg"
              />
              {picks.length > 0 ? (
                <nav aria-label={dict.home.popular}>
                  <ul className="flex flex-wrap gap-2">
                    {picks.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/${locale}/destinations/${item.slug}`}
                          className={cn(
                            type.calloutStrong,
                            'inline-flex h-9 items-center gap-2 rounded-pill border border-line bg-surface-1/70 pe-3.5 ps-1.5 text-fg-secondary',
                            'transition-colors duration-fast ease-vela hover:border-line-strong hover:text-fg',
                            focusRing,
                            press,
                          )}
                        >
                          <Flag code={item.codes[0] ?? ''} size="sm" />
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[34rem]">
            {/* Spinning dotted globe with a pin on every country we sell. Drag to turn it. */}
            <div aria-hidden className="rise-2 mx-auto max-w-[22rem] motion-safe:animate-fade md:max-w-none">
              <DottedGlobe continent={null} focus={null} pins={pins} />
            </div>
          </div>
        </Container>
      </section>

      <Container>
        <ul className="grid border-y border-line sm:grid-cols-3">
          {dict.hero.points.map((point, index) => (
            <li
              key={point}
              className={cn(
                type.calloutStrong,
                'flex items-center gap-3 py-4 text-fg-secondary sm:justify-center sm:py-5',
                index > 0 && 'border-t border-line sm:border-s sm:border-t-0',
              )}
            >
              <span aria-hidden className="h-px w-4 bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}

/** Section headline shared by the home sections below the hero. */
const sectionTitle = cn(
  type.displayLg,
  'md:text-[48px] md:leading-[52px] md:tracking-[-0.02em] md:rtl:text-[40px] md:rtl:leading-[60px] md:rtl:tracking-normal',
);

export function PopularGrid({ locale, dict, destinations }: { locale: Locale; dict: Dictionary; destinations: DestinationSummary[] }) {
  return (
    <Container className="reveal flex flex-col gap-8 py-16 md:py-24">
      <SectionHead id="destinations" title={dict.home.popular} href={`/${locale}/destinations`} linkLabel={dict.home.seeAll} />
      <ul className="grid gap-card-gap sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/${locale}/destinations/${item.slug}`}
              className={cn(cardLink, 'group relative flex h-[104px] items-center gap-4 overflow-hidden px-4 md:px-5')}
            >
              <Flag code={item.codes[0] ?? ''} size="lg" className="relative" />
              <span className="relative flex min-w-0 flex-col gap-0.5">
                <span className={cn(type.bodyStrong, 'leading-tight')}>{item.name}</span>
                <span className={cn(type.caption, 'text-fg-tertiary')}>
                  <LocalFrom slug={item.slug} isRegion={item.isRegion} fallback={item.from} template={dict.destination.from} />
                </span>
              </span>
              <CountryMap
                code={item.codes[0] ?? ''}
                opacity={0.9}
                className="absolute inset-y-4 end-4 w-[34%] object-right transition-transform duration-base ease-vela rtl:object-left motion-safe:group-hover:scale-105 md:end-5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

/** Section headline with an optional "see all" link at the end of the row. */
function SectionHead({ id, title, href, linkLabel }: { id?: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 id={id} className={sectionTitle}>
        {title}
      </h2>
      {href && linkLabel ? (
        <Link
          href={href}
          className={cn(type.calloutStrong, 'group inline-flex items-center gap-3 rounded-chip text-fg-secondary hover:text-fg', focusRing)}
        >
          {linkLabel}
          <Arrow />
        </Link>
      ) : null}
    </div>
  );
}

export function RegionsRow({ locale, dict, regions }: { locale: Locale; dict: Dictionary; regions: DestinationSummary[] }) {
  return (
    <Container className="reveal flex flex-col gap-8 py-16 md:py-24">
      <h2 className={sectionTitle}>{dict.home.regions}</h2>
      <ul className="grid gap-card-gap sm:grid-cols-2 lg:grid-cols-4">
        {regions.map((item) => (
          <li key={item.slug}>
            <RegionCard
              item={item}
              href={`/${locale}/destinations/${item.slug}`}
              wide={false}
              countries={plural(dict.destination as unknown as Record<string, string>, 'countries', item.codes.length, locale)}
              fromTemplate={dict.destination.from}
            />
          </li>
        ))}
      </ul>
    </Container>
  );
}

export function OffersRow({ locale, dict, offers }: { locale: Locale; dict: Dictionary; offers: Offer[] }) {
  // One panel split into columns, like a strip of coupons: no separate floating cards.
  if (offers.length === 0) return null;
  return (
    <Container className="reveal flex flex-col gap-8 py-16 md:py-24">
      <SectionHead title={dict.home.offers} />
      <div className="relative overflow-hidden rounded-card-lg border border-line border-t-line-highlight bg-surface-1">
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 -top-32 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(200,178,133,0.16),transparent_65%)]"
        />
        <ul
          className={cn(
            'relative grid divide-y divide-line md:divide-x md:divide-y-0 rtl:md:divide-x-reverse',
            offers.length >= 3 ? 'md:grid-cols-3' : offers.length === 2 ? 'md:grid-cols-2' : '',
          )}
        >
          {offers.map((offer) => (
            <li key={offer.id} className="relative flex flex-col gap-5 p-6 md:p-8">
              <div className="flex min-h-7 items-center justify-between gap-3">
                <span className={cn(type.labelSm, 'text-accent')}>{localized(offer.tag, locale)}</span>
                {offer.country_codes.length > 0 ? <FlagStack codes={offer.country_codes} size="sm" max={4} /> : null}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className={type.displayMd}>{localized(offer.title, locale)}</h3>
                <p className={cn(type.callout, 'text-fg-secondary')}>{localized(offer.body, locale)}</p>
              </div>
              <div className="mt-auto">
                {offer.code ? (
                  <CopyCode code={offer.code} copyLabel={dict.home.copy} copiedLabel={dict.home.copied} ariaLabel={dict.home.copyAria} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

export function HowItWorks({ dict }: { dict: Dictionary }) {
  return (
    <Container className="reveal grid gap-10 py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:py-24">
      <div>
        <h2 id="how" className={cn(sectionTitle, 'scroll-mt-24 md:sticky md:top-28')}>
          {dict.home.howTitle}
        </h2>
      </div>
      <ol className="flex flex-col">
        {dict.home.steps.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              'grid grid-cols-[56px_minmax(0,1fr)] gap-4 py-7 md:grid-cols-[80px_minmax(0,1fr)] md:py-9',
              index > 0 && 'border-t border-line',
            )}
          >
            <span aria-hidden className="font-display text-[44px] leading-[44px] text-accent tabular-nums md:text-[64px] md:leading-[60px]">
              {index + 1}
            </span>
            <div className="flex flex-col gap-2 pt-1 md:pt-2">
              <h3 className={type.title}>{step.title}</h3>
              <p className={cn(type.body, 'max-w-md text-fg-secondary')}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Container>
  );
}

export function AppBand({ dict }: { dict: Dictionary }) {
  return (
    <Container className="reveal py-16 md:py-24">
      <div className="relative grid items-center gap-10 overflow-hidden rounded-card-lg border border-line border-t-line-highlight bg-surface-1 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -end-20 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(200,178,133,0.18),transparent_62%)]"
        />
        <div id="app" className="relative flex max-w-lg flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className={sectionTitle}>{dict.home.appTitle}</h2>
            <p className={cn(type.body, 'text-fg-secondary md:text-[18px] md:leading-[27px]')}>{dict.home.appBody}</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Button disabled aria-describedby="app-soon">
                {dict.home.ios}
              </Button>
              <Button variant="outline" disabled aria-describedby="app-soon">
                {dict.home.android}
              </Button>
            </div>
            <p id="app-soon" className={cn(type.caption, 'text-fg-tertiary')}>
              {dict.home.appSoon}
            </p>
          </div>
        </div>
        <div aria-hidden className="relative hidden justify-end md:flex">
          <MarkLockup showName={false} className="w-full max-w-[340px] text-fg" />
        </div>
      </div>
    </Container>
  );
}

export function HomeFaq({ locale, dict, title, items }: { locale: Locale; dict: Dictionary; title: string; items: Qa[] }) {
  // A short pick of the FAQ page's questions, in two columns of native disclosures (keyboard and screen reader friendly).
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];
  return (
    <Container className="reveal flex flex-col gap-8 py-16 md:py-24">
      <SectionHead title={title} href={`/${locale}/faq`} linkLabel={dict.home.faqMore} />
      <div className="grid gap-x-10 md:grid-cols-2">
        {columns.map((column, index) => (
          <div key={index} className={cn('flex flex-col', index === 1 ? 'border-b border-line' : 'md:border-b md:border-line')}>
            {column.map((item) => (
              <details key={item.q} className="group border-t border-line">
                <summary
                  className={cn(
                    type.bodyStrong,
                    'flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden',
                    focusRing,
                  )}
                >
                  {item.q}
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-line text-fg-secondary transition duration-base ease-vela group-open:rotate-45 group-open:border-accent/50 group-open:text-accent motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className={cn(type.callout, 'max-w-prose pb-5 pe-14 text-fg-secondary')}>{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </Container>
  );
}
