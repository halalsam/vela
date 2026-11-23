import { VelaLockup } from '@vela/brand/web';
import Link from 'next/link';
import { Container, focusRing } from '@/components/ui';
import { format, path, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const link = cn('text-fg-secondary hover:text-fg', type.callout, focusRing);
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-4">
          <VelaLockup size={26} clearSpace={false} className="text-fg" />
          <p className={cn(type.displayMd, 'text-fg-secondary')}>{dict.footer.tagline}</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href={`${path(locale)}#destinations`} className={link}>
              {dict.nav.destinations}
            </Link>
            <Link href={path(locale, '/account')} className={link}>
              {dict.nav.account}
            </Link>
            <Link href={path(locale, '/privacy')} className={link}>
              {dict.footer.privacy}
            </Link>
            <Link href={path(locale, '/terms')} className={link}>
              {dict.footer.terms}
            </Link>
          </nav>
          <p className={cn(type.caption, 'text-fg-tertiary')}>{dict.footer.prices}</p>
          <p className={cn(type.caption, 'text-fg-tertiary')}>{format(dict.footer.rights, { year: new Date().getFullYear() })}</p>
        </div>
      </Container>
    </footer>
  );
}
