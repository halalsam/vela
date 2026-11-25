'use client';

import { useEffect, useState } from 'react';
import { focusRing, press } from '@/components/ui';
import { format } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

type Props = { code: string; copyLabel: string; copiedLabel: string; ariaLabel: string };

/** Promo code as a dashed coupon; the whole chip copies the code and confirms for two seconds. */
export function CopyCode({ code, copyLabel, copiedLabel, ariaLabel }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context or permission): the code stays visible to copy by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={format(ariaLabel, { code })}
      className={cn(
        'inline-flex h-9 items-stretch overflow-hidden rounded-chip border border-dashed border-accent/50 bg-accent-tint text-accent',
        'transition-colors duration-fast ease-vela hover:border-accent hover:bg-accent/20',
        focusRing,
        press,
      )}
    >
      <span dir="ltr" className={cn(type.labelSm, 'flex items-center px-3 tracking-[0.12em]')}>
        {code}
      </span>
      <span className={cn(type.labelSm, 'flex min-w-[72px] items-center justify-center border-s border-dashed border-accent/50 px-3')}>
        <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
      </span>
    </button>
  );
}
