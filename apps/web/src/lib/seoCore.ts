// Page SEO: the list of editable pages, how a saved override falls back to the built-in default, and the checks the
// admin shows. Pure functions with no server imports, so the admin editor can run them as you type.
import { emptySeoSite, type SeoChangeFrequency, type SeoPage, type SeoSite } from '@vela/api';
import { brandName } from '@vela/brand';
import type { Locale } from './i18n';

export type SeoGroup = 'Main' | 'Destinations' | 'Content' | 'Help' | 'Legal';

export type SeoPageDef = {
  key: string;
  label: string;
  group: SeoGroup;
  /** Path after /<locale>. */
  path: string;
  priority: number;
  changeFrequency: SeoChangeFrequency;
  /** Placeholders the title and description may use. */
  vars?: readonly string[];
  /** The home page title is used as written, without the title template. */
  absoluteTitle?: boolean;
  note?: string;
};

export const DESTINATION_VARS = ['name', 'price', 'countries'] as const;

export const seoPageDefs: SeoPageDef[] = [
  { key: 'home', label: 'Home', group: 'Main', path: '', priority: 1, changeFrequency: 'daily', absoluteTitle: true },
  { key: 'destinations', label: 'All destinations', group: 'Destinations', path: '/destinations', priority: 0.9, changeFrequency: 'daily' },
  {
    key: 'destination',
    label: 'Destination page (template)',
    group: 'Destinations',
    path: '/destinations/{slug}',
    priority: 0.8,
    changeFrequency: 'weekly',
    vars: DESTINATION_VARS,
    note: 'Applies to every country and region page. Override single destinations below.',
  },
  { key: 'blog', label: 'Blog', group: 'Content', path: '/blog', priority: 0.7, changeFrequency: 'daily', note: 'Each post has its own SEO fields in the blog editor.' },
  { key: 'help', label: 'Help centre', group: 'Help', path: '/help', priority: 0.6, changeFrequency: 'monthly' },
  { key: 'faq', label: 'FAQ', group: 'Help', path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { key: 'contact', label: 'Contact', group: 'Help', path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { key: 'terms', label: 'Terms', group: 'Legal', path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { key: 'privacy', label: 'Privacy', group: 'Legal', path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { key: 'refunds', label: 'Refunds', group: 'Legal', path: '/refunds', priority: 0.3, changeFrequency: 'yearly' },
  { key: 'delivery', label: 'Delivery', group: 'Legal', path: '/delivery', priority: 0.3, changeFrequency: 'yearly' },
  { key: 'cookies', label: 'Cookies', group: 'Legal', path: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
];

export const seoPageDef = (key: string) => seoPageDefs.find((def) => def.key === (key.startsWith('destination:') ? 'destination' : key));

export const DEFAULT_TITLE_TEMPLATE = `%s · ${brandName}`;
export const DEFAULT_OG_IMAGE = '/og.png';
export const TITLE_RANGE = [30, 60] as const;
export const DESCRIPTION_RANGE = [70, 160] as const;

/** Built-in text for a page, from the site's own copy. */
export type SeoDefaults = { title: string; description: string; image?: string; imageAlt?: string };

export function fill(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

const text = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

export type ResolvedSeo = {
  title: string;
  /** Title as it shows in the tab and search results, template applied. */
  fullTitle: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  image: string;
  imageAlt: string;
  canonical: string | null;
  noindex: boolean;
  nofollow: boolean;
  priority: number;
  changeFrequency: SeoChangeFrequency;
  structuredData: string[];
  siteName: string;
  /** Which layer each main field came from, for the admin. */
  source: { title: Layer; description: Layer; image: Layer };
};

export type Layer = 'item' | 'page' | 'default' | 'site';

type ResolveInput = {
  locale: Locale;
  site?: SeoSite | null;
  /** Row for the page key, e.g. "destination". */
  page?: SeoPage | null;
  /** Row for one item, e.g. "destination:jp". Wins over the page row. */
  item?: SeoPage | null;
  def?: SeoPageDef;
  defaults: SeoDefaults;
  vars?: Record<string, string>;
};

function pick<T>(layers: [Layer, T | null | undefined][]): [Layer, T] | null {
  for (const [layer, value] of layers) if (value !== null && value !== undefined) return [layer, value];
  return null;
}

/** Item override → page override → page default → site default. */
export function resolveSeo({ locale, site, page, item, def, defaults, vars = {} }: ResolveInput): ResolvedSeo {
  const s = site ?? emptySeoSite();
  const local = s.locales[locale];
  const siteName = text(local.site_name) ?? brandName;
  const [titleSource, rawTitle] = pick<string>([
    ['item', text(item?.meta_title)],
    ['page', text(page?.meta_title)],
    ['default', text(defaults.title)],
    ['site', text(local.default_title)],
  ]) ?? ['site', siteName];
  const [descriptionSource, rawDescription] = pick<string>([
    ['item', text(item?.meta_description)],
    ['page', text(page?.meta_description)],
    ['default', text(defaults.description)],
    ['site', text(local.default_description)],
  ]) ?? ['site', ''];
  const [imageSource, image] = pick<string>([
    ['item', text(item?.og_image)],
    ['page', text(page?.og_image)],
    ['default', text(defaults.image)],
    ['site', text(s.default_og_image)],
  ]) ?? ['site', DEFAULT_OG_IMAGE];
  const title = fill(rawTitle, vars);
  const description = fill(rawDescription, vars);
  const template = text(s.title_template) ?? DEFAULT_TITLE_TEMPLATE;
  const fullTitle = def?.absoluteTitle ? title : template.replace('%s', title);
  const keywords = [item?.keywords, page?.keywords, local.keywords].find((list) => list && list.length > 0) ?? [];
  const flags = item ?? page;
  return {
    title,
    fullTitle,
    description,
    keywords,
    ogTitle: fill(text(item?.og_title) ?? text(page?.og_title) ?? title, vars),
    ogDescription: fill(text(item?.og_description) ?? text(page?.og_description) ?? rawDescription, vars),
    image,
    imageAlt: fill(text(item?.og_image_alt) ?? text(page?.og_image_alt) ?? (imageSource === 'default' ? defaults.imageAlt : null) ?? title, vars),
    canonical: text(item?.canonical_url) ?? text(page?.canonical_url),
    noindex: !s.indexing || Boolean(flags?.noindex),
    nofollow: !s.indexing || Boolean(flags?.nofollow),
    priority: item?.sitemap_priority ?? page?.sitemap_priority ?? def?.priority ?? 0.5,
    changeFrequency: item?.change_frequency ?? page?.change_frequency ?? def?.changeFrequency ?? 'weekly',
    structuredData: [page?.structured_data, item?.structured_data].filter((value): value is string => Boolean(text(value))),
    siteName,
    source: { title: titleSource, description: descriptionSource, image: imageSource },
  };
}

// Checks shown in the admin editor and on the overview.

export type SeoCheck = { id: string; label: string; hint: string; state: 'good' | 'warn' | 'bad' };

const includes = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());
const range = (value: number, [low, high]: readonly [number, number]): SeoCheck['state'] =>
  value >= low && value <= high ? 'good' : value === 0 || value > high + 20 ? 'bad' : 'warn';

export function seoPageChecks(
  resolved: ResolvedSeo,
  options: { rawTitle?: string; rawDescription?: string; vars?: readonly string[]; otherTitles?: string[]; otherDescriptions?: string[]; structuredData?: string | null } = {},
): SeoCheck[] {
  const { fullTitle, description } = resolved;
  const keyword = resolved.keywords[0] ?? '';
  const checks: SeoCheck[] = [
    {
      id: 'title',
      label: `Title is ${fullTitle.length} characters`,
      hint: `Search results show about ${TITLE_RANGE[1]}. Aim for ${TITLE_RANGE[0]} to ${TITLE_RANGE[1]}, including the brand.`,
      state: range(fullTitle.length, TITLE_RANGE),
    },
    {
      id: 'description',
      label: description ? `Description is ${description.length} characters` : 'No description',
      hint: `Aim for ${DESCRIPTION_RANGE[0]} to ${DESCRIPTION_RANGE[1]} characters that say what the visitor gets.`,
      state: range(description.length, DESCRIPTION_RANGE),
    },
  ];
  if (description && description.trim().toLowerCase() === resolved.title.trim().toLowerCase())
    checks.push({ id: 'same', label: 'Description repeats the title', hint: 'Use the description to add detail the title can’t fit.', state: 'warn' });

  if (!keyword) {
    checks.push({ id: 'keyword', label: 'No focus keyword', hint: 'Add the search phrase this page should rank for. The first keyword is the focus.', state: 'warn' });
  } else {
    checks.push(
      { id: 'kw-title', label: 'Focus keyword in the title', hint: `Put “${keyword}” in the title, ideally near the start.`, state: includes(fullTitle, keyword) ? 'good' : 'bad' },
      { id: 'kw-description', label: 'Focus keyword in the description', hint: 'Search engines bold matching words in the snippet.', state: includes(description, keyword) ? 'good' : 'warn' },
    );
  }

  const unknown = [options.rawTitle ?? '', options.rawDescription ?? '']
    .flatMap((value) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? ''))
    .filter((name) => !(options.vars ?? []).includes(name));
  if (unknown.length > 0)
    checks.push({
      id: 'vars',
      label: `Unknown placeholder ${[...new Set(unknown)].map((name) => `{{${name}}}`).join(', ')}`,
      hint: options.vars?.length ? `This page understands ${options.vars.map((name) => `{{${name}}}`).join(', ')}.` : 'This page has no placeholders. The text shows as written.',
      state: 'bad',
    });

  if (options.otherTitles?.some((other) => other.toLowerCase() === fullTitle.toLowerCase()))
    checks.push({ id: 'dup-title', label: 'Another page has the same title', hint: 'Every page needs its own title, or search engines pick one and hide the other.', state: 'bad' });
  if (description && options.otherDescriptions?.some((other) => other.toLowerCase() === description.toLowerCase()))
    checks.push({ id: 'dup-description', label: 'Another page has the same description', hint: 'Write a description for this page alone.', state: 'warn' });

  checks.push(
    {
      id: 'image',
      label: resolved.source.image === 'site' ? 'Uses the site-wide social image' : 'Has its own social image',
      hint: 'A 1200×630 image for this page makes shared links stand out.',
      state: resolved.source.image === 'site' ? 'warn' : 'good',
    },
    { id: 'alt', label: 'Social image has alt text', hint: 'Describe the image for screen readers.', state: resolved.imageAlt.trim() ? 'good' : 'warn' },
  );

  if (options.structuredData) {
    let ok = false;
    try {
      const parsed: unknown = JSON.parse(options.structuredData);
      ok = typeof parsed === 'object' && parsed !== null;
    } catch {
      ok = false;
    }
    checks.push({ id: 'jsonld', label: ok ? 'Extra structured data is valid JSON' : 'Extra structured data isn’t valid JSON', hint: 'Paste a JSON-LD object or array, without the <script> tag.', state: ok ? 'good' : 'bad' });
  }
  if (resolved.canonical) checks.push({ id: 'canonical', label: 'Canonical points to another URL', hint: 'Search engines will rank that URL instead of this page.', state: 'warn' });
  if (resolved.noindex) checks.push({ id: 'noindex', label: 'Hidden from search engines', hint: 'Turn off “Hide from search” (or site-wide indexing) when the page should rank.', state: 'bad' });
  return checks;
}

/** 0–100: good counts fully, warn counts half. */
export function seoScore(checks: SeoCheck[]): number {
  if (checks.length === 0) return 0;
  const points = checks.reduce((sum, check) => sum + (check.state === 'good' ? 1 : check.state === 'warn' ? 0.5 : 0), 0);
  return Math.round((points / checks.length) * 100);
}
