import { VelaLockup } from '@vela/brand/web';
import Link from 'next/link';
import { ButtonLink, Container, focusRing } from '@/components/ui';
import { path, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { LanguageSwitch } from './LanguageSwitch';

export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const link = cn('hidden rounded-pill px-3 py-2 text-fg-secondary transition-colors hover:text-fg md:inline-flex', type.callout, focusRing);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-2">
        <Link href={path(locale)} aria-label={dict.nav.home} className={cn('me-auto rounded-chip', focusRing)}>
          <VelaLockup size={22} clearSpace={false} className="text-fg" title="vela" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href={`${path(locale)}#destinations`} className={link}>
            {dict.nav.destinations}
          </Link>
          <Link href={`${path(locale)}#how`} className={link}>
            {dict.nav.how}
          </Link>
          <Link href={path(locale, '/account')} className={cn(link, 'inline-flex')}>
            {dict.nav.account}
          </Link>
          <LanguageSwitch locale={locale} label={dict.nav.language} />
          <ButtonLink href={`${path(locale)}#app`} size="sm" className="ms-1 hidden sm:inline-flex">
            {dict.nav.getApp}
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}
