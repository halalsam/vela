import { ButtonLink } from '@/components/ui';
import { path, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

/** Closing band on blog pages: from reading to buying. */
export function BlogCta({ locale, labels }: { locale: Locale; labels: Dictionary['blog'] }) {
  return (
    <section className="relative overflow-hidden rounded-card-lg border border-line border-t-line-highlight bg-surface-1 p-6 md:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -end-24 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(200,178,133,0.18),transparent_62%)]"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 className={cn(type.displayLg, 'md:text-[44px] md:leading-[48px]')}>{labels.ctaTitle}</h2>
          <p className={cn(type.body, 'text-fg-secondary md:text-[18px] md:leading-[27px]')}>{labels.ctaBody}</p>
        </div>
        <ButtonLink href={path(locale, '/destinations')} className="self-start md:self-auto">
          {labels.ctaButton}
        </ButtonLink>
      </div>
    </section>
  );
}
