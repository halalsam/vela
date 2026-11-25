/* eslint-disable @next/next/no-img-element -- small static SVGs from /public/geo; next/image adds nothing for these */
import { flagEmoji } from '@vela/utils';
import type { ReactNode } from 'react';
import { flagSrc, mapSrc } from '@/lib/geo';
import { cn, type } from '@/lib/type';

// Point sizes match the app's Flag (sm 20, md 28, lg 40, xl 52, hero 112).
const flagSize = {
  sm: 'h-5 w-5 text-[24px]',
  md: 'h-7 w-7 text-[34px]',
  lg: 'h-10 w-10 text-[48px]',
  xl: 'h-[52px] w-[52px] text-[62px]',
  hero: 'h-28 w-28 md:h-36 md:w-36 text-[136px] md:text-[176px]',
} as const;

export type FlagSize = keyof typeof flagSize;

/** Round flag from the bundled BRIX set; the emoji flag only for codes the set lacks. */
export function Flag({ code, size = 'md', className }: { code: string; size?: FlagSize; className?: string }) {
  const src = flagSrc(code);
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-3 leading-none',
        flagSize[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : flagEmoji(code)}
      <span className="pointer-events-none absolute inset-0 rounded-pill border border-line-strong" />
    </span>
  );
}

export function FlagStack({ codes, size = 'md', max = 3 }: { codes: readonly string[]; size?: FlagSize; max?: number }) {
  return (
    <span className="inline-flex">
      {codes.slice(0, max).map((code, index) => (
        <span key={code} className={cn('rounded-pill border-2 border-surface-1', index > 0 && '-ms-2.5')}>
          <Flag code={code} size={size} />
        </span>
      ))}
    </span>
  );
}

/** Country outline as a quiet watermark. Renders nothing for codes without a map. */
export function CountryMap({ code, className, opacity = 0.07 }: { code: string; className?: string; opacity?: number }) {
  const src = mapSrc(code);
  if (!src) return null;
  return (
    <img aria-hidden src={src} alt="" className={cn('pointer-events-none select-none object-contain', className)} style={{ opacity }} />
  );
}

export type TravelKind = 'active' | 'low' | 'ready' | 'ended';

const pillClass: Record<TravelKind, { box: string; dot: string; text: string }> = {
  active: { box: 'bg-success-tint', dot: 'bg-success', text: 'text-success' },
  low: { box: 'bg-warning-tint', dot: 'bg-warning', text: 'text-warning' },
  ready: { box: 'bg-surface-3', dot: 'border border-fg-secondary', text: 'text-fg' },
  ended: { box: 'bg-danger-tint', dot: 'bg-danger', text: 'text-danger' },
};

export type TravelCardProps = {
  code: string;
  name: string;
  subtitle: string;
  kind: TravelKind;
  status: string;
  amount: { value: string; unit: string };
  amountLabel: string;
  totalLabel: string;
  /** Remaining share, 0 to 1. */
  fraction: number;
  expires?: string | null;
  countdown?: string | null;
  urgent?: boolean;
  readyNote?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Same layout as the app's travel card: status, amount left, usage bar, expiry and countdown, actions. */
export function TravelCard(props: TravelCardProps) {
  const {
    code,
    name,
    subtitle,
    kind,
    status,
    amount,
    amountLabel,
    totalLabel,
    fraction,
    expires,
    countdown,
    urgent,
    readyNote,
    actions,
    children,
    className,
  } = props;
  const pill = pillClass[kind];
  const percent = Math.max(kind === 'ended' ? 0 : 3, Math.round(Math.min(1, Math.max(0, fraction)) * 100));
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 overflow-hidden rounded-card border bg-surface-1 p-3.5',
        kind === 'low' ? 'border-warning/40' : 'border-line border-t-line-highlight',
        className,
      )}
    >
      <CountryMap code={code} className="absolute -end-4 top-8 h-[120px] w-[150px]" />
      <div className="relative flex items-center gap-3">
        <Flag code={code} size="md" className={cn(kind === 'ended' && 'opacity-50')} />
        <div className="min-w-0 flex-1">
          <p className={cn(type.calloutStrong, 'truncate')}>{name}</p>
          <p className={cn(type.caption, 'truncate text-fg-tertiary')}>{subtitle}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5', pill.box)}>
          <span className={cn('h-1.5 w-1.5 rounded-pill', pill.dot)} />
          <span className={cn(type.caption, 'font-sans-semibold rtl:font-arabic-semibold', pill.text)}>{status}</span>
        </span>
      </div>

      <div className="relative flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span
              dir="ltr"
              className={cn(
                'font-display text-[28px] leading-[32px] tabular-nums',
                kind === 'low' ? 'text-warning' : kind === 'ended' ? 'text-fg-tertiary' : 'text-fg',
              )}
            >
              {kind === 'ended' ? '0' : amount.value}
            </span>
            <span className={cn(type.callout, 'text-fg-secondary')}>{amountLabel}</span>
          </p>
          <span className={cn(type.caption, 'pb-1.5 text-fg-tertiary')}>{totalLabel}</span>
        </div>
        {kind === 'ready' ? (
          <div className="flex h-1 gap-1" aria-hidden>
            {Array.from({ length: 22 }, (_, index) => (
              <span key={index} className="flex-1 rounded-pill bg-surface-3" />
            ))}
          </div>
        ) : (
          <div className="h-1 overflow-hidden rounded-pill bg-surface-3" aria-hidden>
            <div className={cn('h-full rounded-pill', kind === 'low' ? 'bg-warning' : 'bg-accent')} style={{ width: `${percent}%` }} />
          </div>
        )}
        {kind === 'ready' ? (
          readyNote ? (
            <p className={cn(type.caption, 'text-fg-secondary')}>{readyNote}</p>
          ) : null
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className={cn(type.caption, 'text-fg-tertiary')}>{expires ?? ''}</span>
            {countdown ? (
              <span dir="ltr" className={cn(type.caption, 'font-sans-semibold', urgent ? 'text-warning' : 'text-fg')}>
                {countdown}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {actions ? <div className="relative flex gap-2 [&>*]:flex-1">{actions}</div> : null}
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}

export function PriceText({ children, className }: { children: string; className?: string }) {
  return (
    <span dir="ltr" className={cn(type.dataSm, 'inline-block', className)}>
      {children}
    </span>
  );
}
