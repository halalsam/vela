'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type CSSProperties } from 'react';

function targetOf(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!anchor || !anchor.href || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return url;
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = `${pathname}?${search}`;
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const url = targetOf(event);
      if (!url) return;
      const next = `${url.pathname}?${url.searchParams.toString()}`;
      const here = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (next === here) return;
      setFrom(here);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const active = from !== null;
  const finished = active && from !== current;
  const style: CSSProperties = !active
    ? { width: '0%', opacity: 0, transition: 'none' }
    : finished
      ? {
          width: '100%',
          opacity: 0,
          transition: 'width 200ms ease-out, opacity 300ms ease 150ms',
        }
      : {
          width: '85%',
          opacity: 1,
          transition: 'width 8s cubic-bezier(0.1, 0.7, 0.2, 1)',
        };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        className="h-full bg-accent shadow-[0_0_8px_var(--tw-shadow-color)] shadow-accent motion-reduce:!transition-none"
        style={style}
        onTransitionEnd={(event) => {
          if (finished && event.propertyName === 'opacity') setFrom(null);
        }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
