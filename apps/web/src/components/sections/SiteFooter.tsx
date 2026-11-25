import { VelaLockup } from '@vela/brand/web';
import Link from 'next/link';
import { Container, focusRing } from '@/components/ui';
import { format, path, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const link = cn('text-fg-secondary hover:text-fg', type.callout, focusRing);
  const f = dict.footer;
  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: f.product,
      links: [
        { href: path(locale, '/destinations'), label: dict.nav.destinations },
        { href: path(locale, '/account'), label: dict.nav.account },
      ],
    },
    {
      title: f.support,
      links: [
        { href: path(locale, '/help'), label: f.help },
        { href: path(locale, '/faq'), label: f.faq },
        { href: path(locale, '/contact'), label: f.contact },
      ],
    },
    {
      title: f.legal,
      links: [
        { href: path(locale, '/terms'), label: f.terms },
        { href: path(locale, '/privacy'), label: f.privacy },
        { href: path(locale, '/refunds'), label: f.refunds },
        { href: path(locale, '/delivery'), label: f.delivery },
        { href: path(locale, '/cookies'), label: f.cookies },
      ],
    },
  ];
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col gap-4">
          <VelaLockup size={26} clearSpace={false} className="text-fg" />
          <p className={cn(type.displayMd, 'text-fg-secondary')}>{f.tagline}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <p className={cn(type.calloutStrong, 'text-fg')}>{column.title}</p>
            <ul className="flex flex-col gap-2">
              {column.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="flex flex-col gap-1 border-t border-line py-6 md:flex-row md:justify-between">
        <p className={cn(type.caption, 'text-fg-tertiary')}>{f.prices}</p>
        <p className={cn(type.caption, 'text-fg-tertiary')}>{format(f.rights, { year: new Date().getFullYear() })}</p>
      </Container>
    </footer>
  );
}
