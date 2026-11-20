import { brandName, markGeometry } from '@vela/brand';
import { cn } from '@/lib/type';

const lockup = markGeometry.horizontal;
const symbolD = lockup.paths[0]?.d ?? '';
const split = symbolD.indexOf(' M', 1);
const sail = symbolD.slice(0, split);
const band = symbolD.slice(split + 1);
const wordmark = lockup.paths[1]?.d ?? '';
const viewBox = `0 0 ${lockup.width} ${lockup.height}`;

export function MarkLockup({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <div dir="ltr" role="img" aria-label={brandName} className={cn('relative aspect-[600.42/176] fill-current', className)}>
      <svg viewBox={viewBox} className="mark-layer mark-sail absolute inset-0 h-full w-full" aria-hidden>
        <path d={sail} />
      </svg>
      <svg viewBox={viewBox} className="mark-layer mark-band absolute inset-0 h-full w-full" aria-hidden>
        <path d={band} />
      </svg>
      {showName ? (
        <svg viewBox={viewBox} className="mark-name absolute inset-0 h-full w-full" aria-hidden>
          <path d={wordmark} fillRule="evenodd" />
        </svg>
      ) : null}
    </div>
  );
}
