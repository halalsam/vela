'use client';

import { format } from '@/lib/i18n';
import { useLocalFrom } from '@/lib/localPrices';

export function LocalFrom({ slug, isRegion, fallback, template = '{{price}}' }: { slug: string; isRegion: boolean; fallback: string; template?: string }) {
  const local = useLocalFrom(slug, isRegion);
  return <>{format(template, { price: local ?? fallback })}</>;
}
