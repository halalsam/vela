'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

export function CopyButton({ value, copy, copied, label }: { value: string; copy: string; copied: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <Button
      variant={done ? 'primary' : 'secondary'}
      size="sm"
      aria-label={`${done ? copied : copy}: ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setDone(true));
      }}
    >
      <span aria-live="polite">{done ? `✓ ${copied}` : copy}</span>
    </Button>
  );
}
