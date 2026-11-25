/* eslint-disable @next/next/no-img-element -- static continent SVGs from /public/geo */
import Link from 'next/link';
import { FlagStack } from '@/components/esim';
import { cardLink } from '@/components/ui';
import type { DestinationSummary } from '@/lib/destinations';
import { cn, type } from '@/lib/type';
import { LocalFrom } from '../LocalFrom';

/** Continent artwork in /public/geo/continents, keyed by catalog region. The Gulf sits on the Asia map; both Americas share one. */
export const continentArt: Record<string, string | undefined> = {
  asia: 'asia',
  gulf: 'asia',
  europe: 'europe',
  americas: 'america',
  africa: 'africa',
  oceania: 'oceania',
};

/** Round arrow button used at the end of destination cards. Needs a `group` parent for the hover nudge. */
export function Arrow() {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-line text-fg-secondary transition duration-fast ease-vela group-hover:border-line-strong group-hover:text-fg motion-safe:group-hover:translate-x-0.5 rtl:-scale-x-100 motion-safe:rtl:group-hover:-translate-x-0.5"
    >
      →
    </span>
  );
}

export function RegionCard({
  item,
  href,
  wide,
  countries,
  fromTemplate,
}: {
  item: DestinationSummary;
  href: string;
  /** One card on its own (a continent filter): lay it out as a full-width row. */
  wide: boolean;
  countries: string;
  fromTemplate: string;
}) {
  const art = continentArt[item.slug] ?? null;
  return (
    <Link
      href={href}
      className={cn(
        cardLink,
        'group relative flex h-full overflow-hidden',
        wide ? 'flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 md:px-6' : 'min-h-[188px] flex-col justify-between gap-6 p-5',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(200,178,133,0.12),transparent_60%)] rtl:bg-[radial-gradient(circle_at_0%_100%,rgba(200,178,133,0.12),transparent_60%)]"
      />
      {art ? (
        <img
          aria-hidden
          src={`/geo/continents/${art}.svg`}
          alt=""
          className={cn(
            'pointer-events-none absolute w-auto max-w-none select-none opacity-[0.08]',
            wide ? '-bottom-10 end-24 h-[180px]' : '-bottom-8 -end-10 h-[150px]',
          )}
        />
      ) : null}
      <span className="relative">
        <FlagStack codes={item.codes} size="lg" max={4} />
      </span>
      <span className={cn('relative flex flex-col gap-1', wide && 'sm:flex-1')}>
        <span className={type.displayMd}>{item.name}</span>
        <span className={cn(type.caption, 'text-fg-tertiary')}>{countries}</span>
      </span>
      <span className="relative flex items-center justify-between gap-3">
        <span className={cn(type.calloutStrong, 'text-fg')}>
          <LocalFrom slug={item.slug} isRegion fallback={item.from} template={fromTemplate} />
        </span>
        <span className={cn(wide && 'sm:ms-3')}>
          <Arrow />
        </span>
      </span>
    </Link>
  );
}
