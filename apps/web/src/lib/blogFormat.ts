import { path, type Locale } from './i18n';

// Pure helpers shared by the site and the admin preview. No API imports, so they are safe in client bundles.

export const blogPath = (locale: Locale, slug?: string) => path(locale, slug ? `/blog/${slug}` : '/blog');
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Same rule as the markdown renderer, so table-of-contents links match heading ids. */
export function headingId(text: string): string {
  const id = text
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return id || 'section';
}

export function outline(body: string): { id: string; text: string }[] {
  // h1 and h2 both render as h2. Repeated headings get -2, -3, like the renderer. Code blocks are skipped.
  const seen = new Map<string, number>();
  return [...body.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,4}\s+(.+?)\s*#*$/gm)].flatMap((match) => {
    const text = (match[1] ?? '').replace(/[*_`]/g, '').trim();
    const base = headingId(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return /^#{1,2}\s/.test(match[0]) ? [{ id: n === 0 ? base : `${base}-${n + 1}`, text }] : [];
  });
}
