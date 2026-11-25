import Link from 'next/link';
import type { ReactNode } from 'react';
import { headingId } from '@/lib/blog';
import { cn, type } from '@/lib/type';

// A small markdown renderer for blog posts. It builds React elements directly (no HTML strings), so post text can
// never inject markup. Supports ## to #### headings, paragraphs, - and 1. lists, > quotes, ``` code, ---, standalone
// images with an optional "caption", and inline **bold**, *italic*, `code` and [links](/path). Works on the server
// and in the admin preview.

type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'image'; alt: string; src: string; caption: string | null }
  | { kind: 'rule' };

const IMAGE = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) body.push(lines[index++] ?? '');
      index += 1;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,4})\s+(.+?)\s*#*$/.exec(trimmed);
    if (heading) {
      // A post has one h1 (its title), so # in the body is demoted to ##.
      const level = Math.max(2, heading[1]?.length ?? 2) as 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, text: heading[2] ?? '' });
      index += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }
    const image = IMAGE.exec(trimmed);
    if (image) {
      blocks.push({ kind: 'image', alt: image[1] ?? '', src: image[2] ?? '', caption: image[3] ?? null });
      index += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      const body: string[] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('>')) body.push((lines[index++] ?? '').trim().replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }
    const bullet = /^([-*+]|\d+[.)])\s+/;
    if (bullet.test(trimmed)) {
      const ordered = /^\d/.test(trimmed);
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? '').trim();
        if (bullet.test(current) && /^\d/.test(current) === ordered) items.push(current.replace(bullet, ''));
        else if (current && !bullet.test(current) && items.length > 0 && /^\s/.test(lines[index] ?? '')) items[items.length - 1] += ` ${current}`;
        else break;
        index += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const body: string[] = [];
    while (index < lines.length) {
      const current = (lines[index] ?? '').trim();
      if (!current || /^(#{1,4}\s|```|>|[-*+]\s|\d+[.)]\s|-{3,}$)/.test(current) || IMAGE.test(current)) break;
      body.push(current);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') });
  }
  return blocks;
}

function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (href.startsWith('#') || /^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
}

function safeSrc(src: string): string | null {
  return (src.startsWith('/') && !src.startsWith('//')) || /^https:\/\//i.test(src) ? src : null;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/;

function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let count = 0;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      out.push(rest);
      break;
    }
    if (match.index > 0) out.push(rest.slice(0, match.index));
    const token = match[0];
    const id = `${key}-${count++}`;
    if (match[1]) {
      out.push(
        <code key={id} className="rounded-chip bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em] text-fg">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      out.push(
        <strong key={id} className="font-sans-semibold text-fg rtl:font-arabic-semibold">
          {inline(token.slice(2, -2), id)}
        </strong>,
      );
    } else if (match[3]) {
      out.push(<em key={id}>{inline(token.slice(1, -1), id)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const label = inline(link?.[1] ?? '', id);
      const href = safeHref(link?.[2] ?? '');
      const linkClass = 'text-fg underline decoration-accent/60 decoration-1 underline-offset-4 transition-colors hover:decoration-accent';
      if (!href) out.push(<span key={id}>{label}</span>);
      else if (href.startsWith('/'))
        out.push(
          <Link key={id} href={href} className={linkClass}>
            {label}
          </Link>,
        );
      else
        out.push(
          <a key={id} href={href} className={linkClass} {...(href.startsWith('#') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
            {label}
          </a>,
        );
    }
    rest = rest.slice(match.index + token.length);
  }
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parse(source);
  const seen = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = headingId(text.replace(/[*_`]/g, ''));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  return (
    <div className={cn('flex flex-col gap-6 text-fg-secondary', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case 'heading': {
            const id = uniqueId(block.text);
            if (block.level === 2)
              return (
                <h2 key={key} id={id} className={cn(type.displayMd, 'mt-6 scroll-mt-28 normal-case text-fg')}>
                  {inline(block.text, key)}
                </h2>
              );
            const Tag = block.level === 3 ? 'h3' : 'h4';
            return (
              <Tag key={key} id={id} className={cn(type.title, 'mt-2 scroll-mt-28 text-fg')}>
                {inline(block.text, key)}
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={key} className={cn(type.body, 'md:text-[18px] md:leading-[30px]')}>
                {inline(block.text, key)}
              </p>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag
                key={key}
                className={cn(
                  type.body,
                  'flex flex-col gap-2.5 ps-6 md:text-[18px] md:leading-[30px]',
                  block.ordered ? 'list-decimal marker:font-sans-semibold marker:text-accent' : 'list-disc marker:text-accent',
                )}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`} className="ps-1.5">
                    {inline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={key} className={cn(type.body, 'border-s-2 border-accent ps-5 text-fg md:text-[19px] md:leading-[31px]')}>
                {inline(block.text, key)}
              </blockquote>
            );
          case 'code':
            return (
              <pre key={key} className="overflow-x-auto rounded-card border border-line bg-surface-1 p-4 text-[14px] leading-6 text-fg" dir="ltr">
                <code className="font-mono">{block.text}</code>
              </pre>
            );
          case 'image': {
            const src = safeSrc(block.src);
            if (!src) return null;
            return (
              <figure key={key} className="flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- post images can come from any https host */}
                <img src={src} alt={block.alt} loading="lazy" decoding="async" className="w-full rounded-card-lg border border-line bg-surface-1" />
                {block.caption ? <figcaption className={cn(type.caption, 'text-fg-tertiary')}>{block.caption}</figcaption> : null}
              </figure>
            );
          }
          case 'rule':
            return <hr key={key} className="border-line" />;
        }
      })}
    </div>
  );
}
