'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { Flag, FlagStack } from '@/components/esim';
import { focusRing } from '@/components/ui';
import type { DestinationSummary } from '@/lib/destinations';
import { cn, type } from '@/lib/type';
import { LocalFrom } from '../LocalFrom';

type Props = {
  locale: string;
  destinations: DestinationSummary[];
  label: string;
  placeholder: string;
  noResults: string;
};

export function DestinationSearch({ locale, destinations, label, placeholder, noResults }: Props) {
  const [query, setQuery] = useState('');
  const listId = useId();
  const needle = query.trim().toLocaleLowerCase();
  const results = useMemo(
    () =>
      needle
        ? destinations
            .filter((item) => [item.name, item.altName, ...item.codes].some((value) => value.toLocaleLowerCase().includes(needle)))
            .slice(0, 6)
        : [],
    [destinations, needle],
  );

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {label}
      </label>
      <div className="flex h-14 items-center gap-3 rounded-pill border border-line bg-surface-1 px-5 transition-colors focus-within:border-fg-tertiary">
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-fg-tertiary stroke-2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" strokeLinecap="round" />
        </svg>
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn('h-full flex-1 bg-transparent text-fg outline-none placeholder:text-fg-tertiary', type.body)}
        />
      </div>
      {needle ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-16 z-30 overflow-hidden rounded-card border border-line bg-surface-2 shadow-2xl motion-safe:animate-fade">
          {results.length === 0 ? (
            <li className={cn('px-5 py-4 text-fg-secondary', type.callout)}>{noResults}</li>
          ) : (
            results.map((item) => (
              <li key={item.slug} role="option" aria-selected={false}>
                <Link
                  href={`/${locale}/destinations/${item.slug}`}
                  className={cn('flex items-center gap-3 px-5 py-3 hover:bg-surface-3', focusRing)}
                >
                  {item.isRegion ? <FlagStack codes={item.codes} /> : <Flag code={item.codes[0] ?? ''} />}
                  <span className={cn(type.bodyStrong, 'flex-1')}>{item.name}</span>
                  <span className={cn(type.caption, 'text-fg-tertiary')}>
                    <LocalFrom slug={item.slug} isRegion={item.isRegion} fallback={item.from} />
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
