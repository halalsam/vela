import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container, focusRing } from '@/components/ui';
import type { FaqGroup, Guide, HelpContent } from '@/lib/help';
import { path, type Dictionary, type Locale } from '@/lib/i18n';
import { legalDetails, legalPages, type LegalDoc, type LegalPageSlug } from '@/lib/legal';
import { cn, type } from '@/lib/type';

type RailLink = { href: string; label: string; current?: boolean };

/**
 * Two-column reading layout shared by the legal, FAQ and help pages: a sticky rail on the left
 * (page links or in-page anchors), the document on the right. Collapses to one column below md,
 * where the rail becomes a horizontal, scrollable row above the content.
 */
function ReadingLayout({ railTitle, rail, children }: { railTitle: string; rail: RailLink[]; children: ReactNode }) {
  return (
    <Container className="grid gap-8 py-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-16 md:py-16">
      <nav aria-label={railTitle} className="md:sticky md:top-24 md:self-start">
        <p className={cn(type.caption, 'mb-3 hidden text-fg-tertiary md:block')}>{railTitle}</p>
        <ul className="-mx-gutter flex gap-1 overflow-x-auto px-gutter pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
          {rail.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                className={cn(
                  type.callout,
                  'block whitespace-nowrap rounded-button px-3 py-2 transition-colors duration-fast ease-vela',
                  item.current ? 'bg-surface-2 text-fg' : 'text-fg-secondary hover:bg-surface-1 hover:text-fg',
                  focusRing,
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="flex min-w-0 max-w-[68ch] flex-col gap-10">{children}</article>
    </Container>
  );
}

function PageHeader({ title, intro, meta }: { title: string; intro: string; meta?: string }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className={cn(type.displayXl, 'md:text-[52px] md:leading-[56px]')}>{title}</h1>
      {meta ? <p className={cn(type.caption, 'text-fg-tertiary')}>{meta}</p> : null}
      <p className={cn(type.body, 'text-fg-secondary')}>{intro}</p>
    </header>
  );
}

function legalLabel(slug: LegalPageSlug, footer: Dictionary['footer']): string {
  return {
    terms: footer.terms,
    privacy: footer.privacy,
    refunds: footer.refunds,
    delivery: footer.delivery,
    cookies: footer.cookies,
    contact: footer.contact,
  }[slug];
}

export function LegalView({
  doc,
  slug,
  locale,
  footer,
}: {
  doc: LegalDoc;
  slug: LegalPageSlug;
  locale: Locale;
  footer: Dictionary['footer'];
}) {
  const rail = legalPages.map((item) => ({ href: path(locale, `/${item}`), label: legalLabel(item, footer), current: item === slug }));
  return (
    <ReadingLayout railTitle={footer.policies} rail={rail}>
      <PageHeader title={doc.title} meta={doc.updated} intro={doc.intro} />
      {doc.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 className={type.title}>{section.heading}</h2>
          {section.body.map((part, index) =>
            Array.isArray(part) ? (
              <ul key={index} className="flex list-disc flex-col gap-2 ps-5 marker:text-fg-tertiary">
                {part.map((item) => (
                  <li key={item} className={cn(type.body, 'text-fg-secondary')}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p key={index} className={cn(type.body, 'text-fg-secondary')}>
                {part}
              </p>
            ),
          )}
        </section>
      ))}
    </ReadingLayout>
  );
}

function StillStuck({ content, locale, footer }: { content: HelpContent['stillStuck']; locale: Locale; footer: Dictionary['footer'] }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line border-t-line-highlight bg-surface-1 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className={type.title}>{content.title}</h2>
        <p className={cn(type.callout, 'text-fg-secondary')}>{content.body}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a
          href={`mailto:${legalDetails.email}`}
          className={cn(
            type.calloutStrong,
            'inline-flex h-button-compact items-center rounded-button bg-fg px-4 text-fg-inverse hover:bg-ivory',
            focusRing,
          )}
        >
          {footer.emailUs}
        </a>
        <Link
          href={path(locale, '/contact')}
          className={cn(
            type.calloutStrong,
            'inline-flex h-button-compact items-center rounded-button border border-line-strong px-4 hover:bg-surface-2',
            focusRing,
          )}
        >
          {footer.contactPage}
        </Link>
      </div>
    </section>
  );
}

function FaqList({ group }: { group: FaqGroup }) {
  return (
    <section id={group.id} className="flex scroll-mt-24 flex-col gap-3">
      <h2 className={type.title}>{group.title}</h2>
      <div className="divide-y divide-line rounded-card border border-line bg-surface-1">
        {group.items.map((item) => (
          <details key={item.q} className="group">
            <summary
              className={cn(
                type.bodyStrong,
                'flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 [&::-webkit-details-marker]:hidden',
                focusRing,
              )}
            >
              {item.q}
              <span
                aria-hidden
                className="text-fg-tertiary transition-transform duration-base ease-vela group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className={cn(type.callout, 'px-4 pb-4 text-fg-secondary')}>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FaqView({ content, locale, footer }: { content: HelpContent; locale: Locale; footer: Dictionary['footer'] }) {
  const rail = content.faq.groups.map((group) => ({ href: `#${group.id}`, label: group.title }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.groups.flatMap((group) =>
      group.items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    ),
  };
  return (
    <ReadingLayout railTitle={footer.onThisPage} rail={rail}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader title={content.faq.title} intro={content.faq.intro} />
      {content.faq.groups.map((group) => (
        <FaqList key={group.id} group={group} />
      ))}
      <StillStuck content={content.stillStuck} locale={locale} footer={footer} />
    </ReadingLayout>
  );
}

function GuideSection({ guide }: { guide: Guide }) {
  return (
    <section id={guide.id} className="flex scroll-mt-24 flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-col gap-1">
        <h2 className={type.title}>{guide.title}</h2>
        {guide.intro ? <p className={cn(type.callout, 'text-fg-secondary')}>{guide.intro}</p> : null}
      </div>
      {guide.steps ? (
        <ol className="flex flex-col gap-4">
          {guide.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className={cn(
                  type.caption,
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-3 font-sans-semibold text-fg',
                )}
              >
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={type.bodyStrong}>{step.title}</span>
                <span className={cn(type.callout, 'text-fg-secondary')}>{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {guide.points ? (
        <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-fg-tertiary">
          {guide.points.map((point) => (
            <li key={point} className={cn(type.callout, 'text-fg-secondary')}>
              {point}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function HelpView({ content, locale, footer }: { content: HelpContent; locale: Locale; footer: Dictionary['footer'] }) {
  const rail = [
    ...content.help.guides.map((guide) => ({ href: `#${guide.id}`, label: guide.title })),
    { href: path(locale, '/faq'), label: footer.faq },
  ];
  return (
    <ReadingLayout railTitle={footer.onThisPage} rail={rail}>
      <PageHeader title={content.help.title} intro={content.help.intro} />
      {content.help.guides.map((guide) => (
        <GuideSection key={guide.id} guide={guide} />
      ))}
      <StillStuck content={content.stillStuck} locale={locale} footer={footer} />
    </ReadingLayout>
  );
}
