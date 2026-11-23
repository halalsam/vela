import { Container } from '@/components/ui';
import type { LegalDoc } from '@/lib/legal';
import { cn, type } from '@/lib/type';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <Container className="py-10 md:py-16">
      <article className="flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <h1 className={type.hero}>{doc.title}</h1>
          <p className={cn(type.caption, 'text-fg-tertiary')}>{doc.updated}</p>
          <p className={cn(type.body, 'text-fg-secondary')}>{doc.intro}</p>
        </header>
        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
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
      </article>
    </Container>
  );
}
