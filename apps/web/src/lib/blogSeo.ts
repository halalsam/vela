// SEO checks for the admin blog editor. Pure functions, so the panel updates as you type.

export const TITLE_SUFFIX = ' · vela';
export const TITLE_RANGE = [30, 60] as const;
export const DESCRIPTION_RANGE = [70, 160] as const;

export type SeoDraft = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_image: string;
  cover_alt: string;
  meta_title: string;
  meta_description: string;
  keywords: string;
  noindex: boolean;
};

export type SeoCheck = { id: string; label: string; hint: string; state: 'good' | 'warn' | 'bad' };

export const effectiveTitle = (draft: Pick<SeoDraft, 'title' | 'meta_title'>) => `${(draft.meta_title.trim() || draft.title.trim()) || 'Untitled'}${TITLE_SUFFIX}`;
export const effectiveDescription = (draft: Pick<SeoDraft, 'excerpt' | 'meta_description'>) => draft.meta_description.trim() || draft.excerpt.trim();

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function plain(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`]/g, ' ');
}

export function wordCount(markdown: string) {
  return plain(markdown).split(/\s+/).filter(Boolean).length;
}

const includes = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

export function seoChecks(draft: SeoDraft): SeoCheck[] {
  const title = effectiveTitle(draft);
  const description = effectiveDescription(draft);
  const keyword = splitList(draft.keywords)[0]?.toLowerCase() ?? '';
  const words = wordCount(draft.body);
  const firstParagraph = plain(draft.body.split(/\n\s*\n/).find((block) => block.trim() && !block.trim().startsWith('#')) ?? '');
  const subheadings = (draft.body.match(/^##\s+/gm) ?? []).length;
  const internalLinks = (draft.body.match(/\]\(\/[^)]*\)/g) ?? []).length;
  const images = [...draft.body.matchAll(/!\[([^\]]*)\]\(/g)];
  const imagesWithoutAlt = images.filter((match) => !(match[1] ?? '').trim()).length;
  const range = (value: number, [low, high]: readonly [number, number]): SeoCheck['state'] =>
    value >= low && value <= high ? 'good' : value === 0 || value > high + 20 ? 'bad' : 'warn';

  const checks: SeoCheck[] = [
    {
      id: 'title',
      label: `Title is ${title.length} characters`,
      hint: `Search results show about ${TITLE_RANGE[1]}. Aim for ${TITLE_RANGE[0]} to ${TITLE_RANGE[1]}, “${TITLE_SUFFIX.trim()}” included.`,
      state: range(title.length, TITLE_RANGE),
    },
    {
      id: 'description',
      label: `Description is ${description.length} characters`,
      hint: `Aim for ${DESCRIPTION_RANGE[0]} to ${DESCRIPTION_RANGE[1]}. With no meta description, the excerpt is used.`,
      state: range(description.length, DESCRIPTION_RANGE),
    },
  ];

  if (!keyword) {
    checks.push({ id: 'keyword', label: 'No focus keyword', hint: 'Add the search phrase this post should rank for. The first keyword is the focus.', state: 'warn' });
  } else {
    const slugKeyword = slugify(keyword);
    checks.push(
      { id: 'kw-title', label: 'Focus keyword in the title', hint: `Put “${keyword}” in the title, ideally near the start.`, state: includes(title, keyword) ? 'good' : 'bad' },
      { id: 'kw-description', label: 'Focus keyword in the description', hint: 'Search engines bold matching words in the snippet.', state: includes(description, keyword) ? 'good' : 'warn' },
      { id: 'kw-intro', label: 'Focus keyword in the first paragraph', hint: 'Say what the post is about early.', state: includes(firstParagraph, keyword) ? 'good' : 'warn' },
      {
        id: 'kw-slug',
        label: 'Focus keyword in the URL',
        hint: 'Short, readable slugs with the keyword do best.',
        state: slugKeyword.split('-').every((part) => draft.slug.includes(part)) ? 'good' : 'warn',
      },
    );
  }

  checks.push(
    {
      id: 'slug',
      label: draft.slug ? `URL slug is ${draft.slug.length} characters` : 'No URL slug',
      hint: 'Keep it under 60 characters: lowercase words and hyphens.',
      state: !draft.slug ? 'bad' : draft.slug.length <= 60 ? 'good' : 'warn',
    },
    {
      id: 'length',
      label: `${words} words`,
      hint: 'Guides that rank usually run 600 words or more. Under 300 can look thin.',
      state: words >= 600 ? 'good' : words >= 300 ? 'warn' : 'bad',
    },
    {
      id: 'headings',
      label: `${subheadings} subheading${subheadings === 1 ? '' : 's'}`,
      hint: 'Use ## headings to break the post up. They also build the table of contents.',
      state: subheadings >= 2 ? 'good' : 'warn',
    },
    {
      id: 'links',
      label: internalLinks > 0 ? `${internalLinks} internal link${internalLinks === 1 ? '' : 's'}` : 'No internal links',
      hint: 'Link to a destination or help page, e.g. [Japan eSIM](/en/destinations/jp).',
      state: internalLinks > 0 ? 'good' : 'warn',
    },
    {
      id: 'alt',
      label: draft.cover_image && !draft.cover_alt.trim() ? 'Cover image has no alt text' : imagesWithoutAlt > 0 ? `${imagesWithoutAlt} image${imagesWithoutAlt === 1 ? '' : 's'} without alt text` : 'Images have alt text',
      hint: 'Describe each image for screen readers and image search.',
      state: (draft.cover_image && !draft.cover_alt.trim()) || imagesWithoutAlt > 0 ? 'bad' : 'good',
    },
  );

  if (draft.noindex) checks.push({ id: 'noindex', label: 'Hidden from search engines', hint: 'Turn off “Hide from search” when the post should rank.', state: 'warn' });
  return checks;
}

/** 0–100: good counts fully, warn counts half. */
export function seoScore(checks: SeoCheck[]): number {
  if (checks.length === 0) return 0;
  const points = checks.reduce((sum, check) => sum + (check.state === 'good' ? 1 : check.state === 'warn' ? 0.5 : 0), 0);
  return Math.round((points / checks.length) * 100);
}
