'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Flag } from '@/components/esim';
import { cardLink, focusRing, press } from '@/components/ui';
import { countryCoordinates } from '@/lib/coordinates';
import type { DestinationSummary } from '@/lib/destinations';
import { format, plural, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { LocalFrom } from '../LocalFrom';
import { Arrow, RegionCard } from './cards';
import { DottedGlobe } from './DottedGlobe';

type Continent = NonNullable<DestinationSummary['continent']>;
type Filter = 'all' | Continent;

const FILTERS: Filter[] = ['all', 'asia', 'europe', 'gulf', 'americas', 'africa', 'oceania'];

// Where the globe turns for each continent: roughly the middle of its land, so the whole continent is in view.
const CONTINENT_CENTRES: Record<Continent, readonly [number, number]> = {
  asia: [32, 92],
  europe: [50, 14],
  gulf: [23.5, 50],
  americas: [12, -82],
  africa: [3, 20],
  oceania: [-24, 142],
};

function normalise(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}

type Props = {
  locale: Locale;
  labels: Dictionary['destinations'];
  destinationLabels: Dictionary['destination'];
  countries: DestinationSummary[];
  regions: DestinationSummary[];
};

export function DestinationIndex({ locale, labels, destinationLabels, countries, regions }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const deferredQuery = useDeferredValue(query);
  const needle = normalise(deferredQuery.trim());

  const matches = (item: DestinationSummary) =>
    !needle ||
    normalise(item.name).includes(needle) ||
    normalise(item.altName).includes(needle) ||
    item.codes.some((code) => code.toLowerCase() === needle);

  // Per-continent totals for the filter chips. Continents with no countries are not offered.
  const counts = useMemo(() => {
    const map = new Map<Continent, number>();
    for (const item of countries) if (item.continent) map.set(item.continent, (map.get(item.continent) ?? 0) + 1);
    return map;
  }, [countries]);
  const filters = FILTERS.filter((item) => item === 'all' || (counts.get(item) ?? 0) > 0);

  // Countries grouped by continent, in filter order, alphabetical inside each group.
  const groups = useMemo(() => {
    const shown = countries
      .filter((item) => (filter === 'all' || item.continent === filter) && matches(item))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
    return FILTERS.filter((item): item is Continent => item !== 'all')
      .map((continent) => [continent, shown.filter((item) => item.continent === continent)] as const)
      .filter(([, items]) => items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matches only reads needle
  }, [countries, filter, needle, locale]);

  // All regional plans under "All"; under a continent, only that continent's plan (Asia, Europe, Gulf).
  const shownRegions = regions.filter((item) => (filter === 'all' || item.slug === filter) && matches(item));

  const countryTotal = groups.reduce((sum, [, items]) => sum + items.length, 0);
  const total = countryTotal + shownRegions.length;
  // A pin on every country we sell; on a continent, only its own pins stay.
  const globePins = useMemo(
    () =>
      countries.flatMap((item) => {
        const location = countryCoordinates[item.codes[0] ?? ''];
        return location ? [{ location, active: filter === 'all' || item.continent === filter }] : [];
      }),
    [countries, filter],
  );
  const href = (slug: string) => `/${locale}/destinations/${slug}`;
  const countriesLabel = (count: number) => plural(destinationLabels as unknown as Record<string, string>, 'countries', count, locale);

  return (
    <>
      {/* Fixed height on desktop so switching between the globe (All) and a continent never shifts the page. */}
      <header className="relative md:flex md:min-h-[400px] md:flex-col md:justify-center">
        {/* Globe: spins on "All"; on a continent it turns there and that whole continent's land lights up champagne. Drag to turn it. */}
        <div aria-hidden className="absolute end-0 top-1/2 hidden h-[380px] w-[380px] -translate-y-1/2 md:block lg:h-[400px] lg:w-[400px]">
          <DottedGlobe
            continent={filter === 'all' ? null : filter}
            focus={filter === 'all' ? null : CONTINENT_CENTRES[filter]}
            pins={globePins}
          />
        </div>
        <div className="relative flex max-w-2xl flex-col gap-4 pb-10 pt-12 md:py-12">
          <h1
            className={cn(
              type.displayXl,
              'md:text-[72px] md:leading-[72px] md:tracking-[-0.03em] md:rtl:text-[60px] md:rtl:leading-[84px] md:rtl:tracking-normal',
            )}
          >
            {labels.title}
          </h1>
          <p className={cn(type.body, 'max-w-md text-fg-secondary md:text-[18px] md:leading-[27px]')}>
            {format(labels.intro, {
              countries: countries.length,
              regions: regions.length,
            })}
          </p>
        </div>
      </header>

      <div className="z-30 -mx-gutter flex flex-col gap-3 border-y border-line bg-canvas/85 px-gutter py-3 backdrop-blur-xl md:sticky md:top-16 md:-mx-8 md:flex-row md:items-center md:gap-4 md:px-8">
        <label className="flex h-11 items-center gap-3 rounded-button border border-line bg-surface-1 px-4 transition-colors focus-within:border-accent/60 md:w-72 md:shrink-0">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-fg-tertiary"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="sr-only">{labels.search}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.search}
            className={cn(type.callout, 'h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-tertiary')}
          />
        </label>
        <div role="radiogroup" aria-label={labels.filterLabel} className="flex flex-wrap gap-1.5">
          {filters.map((item) => {
            const selected = filter === item;
            const count = item === 'all' ? countries.length + regions.length : (counts.get(item) ?? 0);
            return (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFilter(item)}
                className={cn(
                  type.calloutStrong,
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 transition-colors duration-fast ease-vela',
                  selected
                    ? 'border-fg bg-fg text-fg-inverse'
                    : 'border-line bg-surface-1 text-fg-secondary hover:border-line-strong hover:text-fg',
                  focusRing,
                  press,
                )}
              >
                {labels[item]}
                <span aria-hidden className={cn('tabular-nums', selected ? 'text-fg-inverse/55' : 'text-fg-quaternary')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className={cn(type.caption, 'text-fg-tertiary md:ms-auto md:shrink-0')}>
          {format(labels.results, { count: total })}
        </p>
      </div>

      <div key={filter} className="flex flex-col gap-14 pb-6 pt-10 motion-safe:animate-fade md:gap-16 md:pt-12">
        {total === 0 ? (
          <div className="flex flex-col items-start gap-3 py-10">
            <h2 className={type.displayMd}>{labels.noResultsTitle}</h2>
            <p className={cn(type.body, 'text-fg-secondary')}>{labels.noResultsBody}</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
              className={cn(
                type.calloutStrong,
                'h-button-compact rounded-button border border-line-strong px-4 hover:bg-surface-2',
                focusRing,
                press,
              )}
            >
              {labels.clear}
            </button>
          </div>
        ) : null}

        {shownRegions.length > 0 ? (
          <section aria-labelledby="regions-title" className="flex flex-col gap-5">
            <GroupTitle id="regions-title" title={labels.regions} count={shownRegions.length} />
            <ul className={cn('grid gap-card-gap', shownRegions.length > 1 && 'sm:grid-cols-2 lg:grid-cols-4')}>
              {shownRegions.map((item) => (
                <li key={item.slug}>
                  <RegionCard
                    item={item}
                    href={href(item.slug)}
                    wide={shownRegions.length === 1}
                    countries={countriesLabel(item.codes.length)}
                    fromTemplate={destinationLabels.from}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {groups.map(([continent, items]) => (
          <section key={continent} aria-labelledby={`group-${continent}`} className="flex flex-col gap-5">
            <GroupTitle id={`group-${continent}`} title={filter === 'all' ? labels[continent] : labels.countries} count={items.length} />
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={item.slug}>
                  <CountryRow item={item} href={href(item.slug)} fromTemplate={destinationLabels.from} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function GroupTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 id={id} className={type.displayMd}>
        {title}
      </h2>
      <span aria-hidden className={cn(type.dataSm, 'text-fg-quaternary')}>
        {count}
      </span>
    </div>
  );
}

function CountryRow({ item, href, fromTemplate }: { item: DestinationSummary; href: string; fromTemplate: string }) {
  return (
    <Link href={href} className={cn(cardLink, 'group flex min-h-[68px] items-center gap-3.5 py-3 pe-3 ps-3.5')}>
      <Flag code={item.codes[0] ?? ''} size="lg" />
      <span className={cn(type.bodyStrong, 'min-w-0 flex-1 leading-tight')}>{item.name}</span>
      <span className={cn(type.callout, 'shrink-0 text-fg-secondary')}>
        <LocalFrom slug={item.slug} isRegion={false} fallback={item.from} template={fromTemplate} />
      </span>
      <Arrow />
    </Link>
  );
}
