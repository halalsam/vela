'use client';

import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Card } from '@/components/ui';
import { adminFetch } from '@/lib/adminApi';
import { cn, type } from '@/lib/type';

export const inputClass = cn(
  type.body,
  'h-button rounded-button border border-line bg-surface-1 px-4 text-fg placeholder:text-fg-tertiary outline-none transition-colors duration-fast ease-vela focus:border-fg-tertiary',
);

export function Select({ label, className, children, ...rest }: ComponentProps<'select'> & { label: string }) {
  return (
    <label className={cn('flex flex-col gap-2', className)}>
      <span className={cn(type.label, 'text-fg-tertiary')}>{label}</span>
      <select className={inputClass} {...rest}>
        {children}
      </select>
    </label>
  );
}

export function TextArea({ label, hint, className, ...rest }: ComponentProps<'textarea'> & { label: string; hint?: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-2', className)}>
      <span className={cn(type.label, 'text-fg-tertiary')}>{label}</span>
      <textarea className={cn(inputClass, 'h-auto py-3')} {...rest} />
      {hint ? <span className={cn(type.caption, 'text-fg-tertiary')}>{hint}</span> : null}
    </label>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col gap-3 p-section', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(type.label, 'text-fg-tertiary')}>{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2 first:border-t-0">
      <dt className={cn(type.callout, 'text-fg-secondary')}>{label}</dt>
      <dd className={cn(type.callout, 'min-w-0 text-end tabular-nums')}>{children}</dd>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
      {children}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none', className ?? 'h-60')} aria-busy />;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="p-section">
      <p className={cn(type.callout, 'text-fg-secondary')}>{children}</p>
    </Card>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 px-5 py-4">
      <span className={cn(type.labelSm, 'text-fg-tertiary')}>{label}</span>
      <span className={type.dataMd}>{value}</span>
      {hint ? <span className={cn(type.caption, 'text-fg-tertiary')}>{hint}</span> : null}
    </Card>
  );
}

/**
 * Loads `path` and reloads it every `every` ms while the tab is visible. `null` skips loading.
 * Returns the data, the last error and a `reload` that also accepts fresh data directly.
 */
export function usePolled<T>(path: string | null, every = 0) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    const load = () =>
      adminFetch<T>(path).then(
        (data) => live && setState({ path, data, error: null }),
        (caught: unknown) =>
          live &&
          setState((current) => ({
            path,
            data: current.path === path ? current.data : null,
            error: caught instanceof Error ? caught.message : 'Couldn’t load this',
          })),
      );
    void load();
    const timer = every
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void load();
        }, every)
      : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [path, every, tick]);

  const reload = useCallback(
    (fresh?: T) => {
      if (fresh !== undefined) setState({ path, data: fresh, error: null });
      else setTick((value) => value + 1);
    },
    [path],
  );

  const current = state.path === path ? state : { data: null, error: null };
  return { data: current.data, error: current.error, reload };
}
