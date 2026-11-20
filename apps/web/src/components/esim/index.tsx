import { flagEmoji } from '@vela/utils';
import { cn, type } from '@/lib/type';

const flagSize = {
  md: 'h-8 w-8 text-[38px] leading-[44px]',
  lg: 'h-11 w-11 text-[52px] leading-[60px]',
  xl: 'h-16 w-16 text-[76px] leading-[88px]',
  hero: 'h-28 w-28 md:h-36 md:w-36 text-[136px] leading-[156px] md:text-[176px] md:leading-[200px]',
} as const;

export function Flag({ code, size = 'md', className }: { code: string; size?: keyof typeof flagSize; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill border border-line bg-surface-3', flagSize[size], className)}
    >
      {flagEmoji(code)}
    </span>
  );
}

export function FlagStack({ codes, size = 'md', max = 3 }: { codes: readonly string[]; size?: keyof typeof flagSize; max?: number }) {
  return (
    <span className="inline-flex">
      {codes.slice(0, max).map((code, index) => (
        <Flag key={code} code={code} size={size} className={cn('border-2 border-surface-1', index > 0 && '-ms-2.5')} />
      ))}
    </span>
  );
}

const RING = 64;
const STROKE = 6;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function UsageRing({ fraction, tone = 'accent', label }: { fraction: number; tone?: 'accent' | 'warning' | 'danger' | 'muted'; label: string }) {
  const stroke = { accent: 'stroke-accent', warning: 'stroke-warning', danger: 'stroke-danger', muted: 'stroke-fg-quaternary' }[tone];
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <svg viewBox={`0 0 ${RING} ${RING}`} className="h-16 w-16 -rotate-90" role="img" aria-label={label}>
      <circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-surface-3" />
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        className={cn(stroke, 'animate-ring-draw motion-reduce:animate-none')}
      />
    </svg>
  );
}

export function PriceText({ children, className }: { children: string; className?: string }) {
  return (
    <span dir="ltr" className={cn(type.dataSm, 'inline-block', className)}>
      {children}
    </span>
  );
}
