'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { focusRing } from '@/components/ui';
import { otherLocale, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const target = otherLocale(locale);
  const href = pathname.replace(/^\/(en|ar)(?=\/|$)/, `/${target}`);
  return (
    <Link
      href={href}
      hrefLang={target}
      lang={target}
      className={cn('rounded-pill px-3 py-2 text-fg-secondary hover:text-fg', type.callout, target === 'ar' ? 'font-arabic' : 'font-sans', focusRing)}
    >
      {label}
    </Link>
  );
}
