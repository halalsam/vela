'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Markdown } from '@/components/sections/blog/Markdown';
import { PostCover } from '@/components/sections/blog/PostCards';
import { Button, Card, Pill, focusRing } from '@/components/ui';
import { adminFetch, blogState, when, type AdminBlogPost } from '@/lib/adminApi';
import {
  DESCRIPTION_RANGE,
  effectiveDescription,
  effectiveTitle,
  seoChecks,
  seoScore,
  slugify,
  splitList,
  TITLE_RANGE,
  wordCount,
  type SeoCheck,
} from '@/lib/blogSeo';
import { siteUrl } from '@/lib/site';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';
import { scoreTone } from './BlogListView';

type Form = {
  locale: 'en' | 'ar';
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string;
  cover_alt: string;
  author_name: string;
  author_role: string;
  tags: string;
  country_codes: string;
  status: 'draft' | 'published';
  /** datetime-local value in the browser's time zone. */
  published_at: string;
  alternate_slug: string;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  og_image: string;
  keywords: string;
  noindex: boolean;
};

const blank: Form = {
  locale: 'en',
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  cover_image: '',
  cover_alt: '',
  author_name: 'The vela team',
  author_role: 'Travel desk',
  tags: '',
  country_codes: '',
  status: 'draft',
  published_at: '',
  alternate_slug: '',
  meta_title: '',
  meta_description: '',
  canonical_url: '',
  og_image: '',
  keywords: '',
  noindex: false,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toForm(post: AdminBlogPost): Form {
  return {
    locale: post.locale,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    cover_image: post.cover_image ?? '',
    cover_alt: post.cover_alt,
    author_name: post.author.name,
    author_role: post.author.role ?? '',
    tags: post.tags.join(', '),
    country_codes: post.country_codes.join(', '),
    status: post.status,
    published_at: toLocalInput(post.published_at),
    alternate_slug: post.alternate_slug ?? '',
    meta_title: post.seo.meta_title ?? '',
    meta_description: post.seo.meta_description ?? '',
    canonical_url: post.seo.canonical_url ?? '',
    og_image: post.seo.og_image ?? '',
    keywords: post.seo.keywords.join(', '),
    noindex: post.seo.noindex,
  };
}

function toBody(form: Form) {
  return {
    ...form,
    slug: form.slug.trim(),
    title: form.title.trim(),
    excerpt: form.excerpt.trim(),
    tags: splitList(form.tags),
    country_codes: splitList(form.country_codes).map((code) => code.toUpperCase()),
    keywords: splitList(form.keywords),
    published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
  };
}

function problems(form: Form): string[] {
  const out: string[] = [];
  if (form.title.trim().length < 3) out.push('Add a title.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim()) || form.slug.trim().length < 3)
    out.push('The URL slug needs at least 3 lowercase letters, numbers or single hyphens.');
  if (form.excerpt.trim().length < 10) out.push('Write an excerpt of at least 10 characters.');
  if (!form.body.trim()) out.push('The post has no body.');
  if (!form.author_name.trim()) out.push('Add an author.');
  const bad = splitList(form.country_codes).filter((code) => !/^[A-Za-z]{2}$/.test(code));
  if (bad.length > 0) out.push(`Use two-letter country codes (not ${bad.join(', ')}).`);
  if (form.canonical_url && !/^https:\/\//.test(form.canonical_url)) out.push('The canonical URL must start with https://.');
  for (const [label, value] of [
    ['Cover image', form.cover_image],
    ['Social image', form.og_image],
  ] as const)
    if (value && !(value.startsWith('/') || /^https:\/\//.test(value))) out.push(`${label} must be an https:// URL or a path starting with /.`);
  return out;
}

export function BlogEditor({ id }: { id?: string }) {
  const role = useStaffRole();
  const router = useRouter();
  const [post, setPost] = useState<AdminBlogPost | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [saved, setSaved] = useState<Form>(blank);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  // New posts take their slug from the title until someone edits the slug by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(id));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    adminFetch<AdminBlogPost>(`/v1/admin/blog/${id}`).then(
      (data) => {
        if (cancelled) return;
        setPost(data);
        setForm(toForm(data));
        setSaved(toForm(data));
        setLoading(false);
      },
      (caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : 'Couldn’t load the post');
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set =
    <K extends keyof Form>(key: K) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = (event.target instanceof HTMLInputElement && event.target.type === 'checkbox' ? event.target.checked : event.target.value) as Form[K];
      setForm((current) => {
        const next = { ...current, [key]: value };
        if (key === 'title' && !slugTouched) next.slug = slugify(String(value));
        return next;
      });
    };

  const checks = useMemo(() => seoChecks(form), [form]);
  const score = seoScore(checks);
  const canPublish = role === 'admin';
  const lockedForSupport = !canPublish && post?.status === 'published';
  const state = blogState({ status: form.status, published_at: form.published_at ? new Date(form.published_at).toISOString() : null });
  const liveUrl = post && blogState(post) === 'published' ? `/${post.locale}/blog/${post.slug}` : null;

  async function save(event?: FormEvent, override?: Partial<Form>) {
    event?.preventDefault();
    const next = { ...form, ...override };
    const issues = problems(next);
    if (issues.length > 0) {
      setError(issues.join(' '));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = id
        ? await adminFetch<AdminBlogPost>(`/v1/admin/blog/${id}`, { method: 'PATCH', body: toBody(next) })
        : await adminFetch<AdminBlogPost>('/v1/admin/blog', { method: 'POST', body: toBody(next) });
      setPost(result);
      setForm(toForm(result));
      setSaved(toForm(result));
      setNotice(blogState(result) === 'published' ? 'Saved. The post is live.' : blogState(result) === 'scheduled' ? `Saved. Goes live ${when(result.published_at)}.` : 'Draft saved.');
      if (!id) router.replace(`/admin/blog/${result.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save the post');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !window.confirm('Delete this post? This can’t be undone, and its URL will stop working.')) return;
    setBusy(true);
    try {
      await adminFetch(`/v1/admin/blog/${id}`, { method: 'DELETE' });
      setSaved(form);
      router.push('/admin/blog');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t delete the post');
      setBusy(false);
    }
  }

  if (loading) return <div className="h-[70vh] animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" aria-busy />;
  if (id && !post) {
    return (
      <Card className="flex flex-col items-start gap-3 p-section">
        <p className={type.title}>Post not found</p>
        <p className={cn(type.callout, 'text-fg-secondary')}>{error}</p>
        <Link href="/admin/blog" className={cn(type.calloutStrong, 'text-accent')}>
          Back to posts
        </Link>
      </Card>
    );
  }

  const rtl = form.locale === 'ar';
  const countries = splitList(form.country_codes)
    .map((code) => code.toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/blog" className={cn(type.callout, 'rounded-chip text-fg-secondary hover:text-fg', focusRing)}>
          ← Posts
        </Link>
        <Pill tone={state === 'draft' ? 'neutral' : state === 'scheduled' ? 'accent' : 'success'}>{state}</Pill>
        {dirty ? <span className={cn(type.caption, 'text-warning')}>Unsaved changes</span> : null}
        <div className="ms-auto flex items-center gap-2">
          {liveUrl ? (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={cn(type.calloutStrong, 'rounded-button px-4 py-2 text-fg-secondary hover:bg-surface-2 hover:text-fg', focusRing)}>
              View live ↗
            </a>
          ) : null}
          <Button type="submit" disabled={busy || lockedForSupport || (!dirty && Boolean(id))}>
            {busy ? 'Saving…' : id ? 'Save changes' : 'Create post'}
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="contents">
        {error ? (
          <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
            {error}
          </p>
        ) : null}
        {notice ? <p className={cn(type.callout, 'rounded-button bg-success-tint px-4 py-3 text-success')}>{notice}</p> : null}
        {lockedForSupport ? (
          <p className={cn(type.callout, 'rounded-button bg-warning-tint px-4 py-3 text-warning')}>This post is live. Only an admin can change it.</p>
        ) : null}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Panel title="Content">
            <label className="flex flex-col gap-2">
              <Label>Title</Label>
              <input
                value={form.title}
                onChange={set('title')}
                dir={rtl ? 'rtl' : 'ltr'}
                placeholder="How to install a travel eSIM on iPhone"
                className={cn(input, 'h-14 text-[22px] font-sans-semibold rtl:font-arabic-semibold')}
              />
            </label>
            <label className="flex flex-col gap-2">
              <Label hint="Lowercase words and hyphens. Changing it after publishing breaks old links.">URL slug</Label>
              <div className={cn(input, 'flex items-center gap-0 p-0 focus-within:border-accent/60')} dir="ltr">
                <span className={cn(type.callout, 'shrink-0 ps-4 text-fg-tertiary')}>/{form.locale}/blog/</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setForm({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, '-') });
                  }}
                  placeholder={rtl ? 'tathbit-esim-iphone' : 'install-esim-iphone'}
                  className="h-full min-w-0 flex-1 bg-transparent pe-4 text-fg outline-none placeholder:text-fg-quaternary"
                />
              </div>
              {rtl && !form.slug ? <span className={cn(type.caption, 'text-fg-tertiary')}>Arabic titles need a Latin slug, written by hand.</span> : null}
            </label>
            <label className="flex flex-col gap-2">
              <Label count={[form.excerpt.length, 320]} hint="Shown on cards and under the title. Also the meta description unless you set one.">
                Excerpt
              </Label>
              <textarea value={form.excerpt} onChange={set('excerpt')} rows={3} maxLength={320} dir={rtl ? 'rtl' : 'ltr'} className={cn(input, 'h-auto py-3')} />
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Body</Label>
                <div role="tablist" aria-label="Body view" className="flex rounded-pill border border-line p-0.5">
                  {(['write', 'preview'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="tab"
                      aria-selected={tab === item}
                      onClick={() => setTab(item)}
                      className={cn(type.caption, 'rounded-pill px-3 py-1 capitalize', tab === item ? 'bg-surface-3 text-fg' : 'text-fg-tertiary hover:text-fg', focusRing)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              {tab === 'write' ? (
                <textarea
                  value={form.body}
                  onChange={set('body')}
                  rows={22}
                  dir={rtl ? 'rtl' : 'ltr'}
                  spellCheck
                  placeholder={'Write in markdown.\n\n## A subheading\n\nA paragraph with **bold**, *italic* and a [link](/en/destinations/jp).\n\n- A list item\n\n> A tip\n\n![Alt text](https://… "Caption")'}
                  className={cn(input, 'h-auto min-h-[480px] py-3 font-mono text-[14px] leading-6')}
                />
              ) : (
                <div dir={rtl ? 'rtl' : 'ltr'} lang={form.locale} className="min-h-[480px] rounded-button border border-line bg-canvas px-6 py-6">
                  {form.body.trim() ? <Markdown source={form.body} /> : <p className={cn(type.callout, 'text-fg-tertiary')}>Nothing to preview yet.</p>}
                </div>
              )}
              <p className={cn(type.caption, 'text-fg-tertiary')}>
                {wordCount(form.body)} words · ## headings build the table of contents · links starting with / open on the site
              </p>
            </div>
          </Panel>

          <Panel title="Cover">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="flex flex-col gap-4">
                <TextField label="Image URL" value={form.cover_image} onChange={set('cover_image')} placeholder="https://… or /images/…" hint="1600×900 or larger. Leave empty for a drawn cover from the first country." />
                <TextField label="Alt text" value={form.cover_alt} onChange={set('cover_alt')} placeholder="A traveller checking a map on their phone at Shibuya crossing" />
              </div>
              <PostCover post={{ cover_image: form.cover_image || null, cover_alt: form.cover_alt, country_codes: countries }} ratio="aspect-[16/10]" />
            </div>
          </Panel>

          <Panel title="Search and social">
            <SearchPreview form={form} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 md:col-span-2">
                <Label count={[effectiveTitle(form).length, TITLE_RANGE[1]]} hint="Leave empty to use the title. “ · vela” is added for you.">
                  Meta title
                </Label>
                <input value={form.meta_title} onChange={set('meta_title')} maxLength={70} dir={rtl ? 'rtl' : 'ltr'} placeholder={form.title} className={input} />
              </label>
              <label className="flex flex-col gap-2 md:col-span-2">
                <Label count={[effectiveDescription(form).length, DESCRIPTION_RANGE[1]]} hint="Leave empty to use the excerpt.">
                  Meta description
                </Label>
                <textarea value={form.meta_description} onChange={set('meta_description')} rows={3} maxLength={200} dir={rtl ? 'rtl' : 'ltr'} placeholder={form.excerpt} className={cn(input, 'h-auto py-3')} />
              </label>
              <TextField label="Keywords" value={form.keywords} onChange={set('keywords')} placeholder="install esim iphone, travel esim" hint="Comma separated. The first is the focus keyword for the checks." />
              <TextField label="Social image URL" value={form.og_image} onChange={set('og_image')} placeholder="https://…" hint="1200×630. Empty uses the cover, then a generated card." />
              <TextField label="Canonical URL" value={form.canonical_url} onChange={set('canonical_url')} placeholder="https://…" hint="Only when this post first appeared on another site." />
              <label className={cn('flex items-start gap-3 self-end rounded-button border border-line bg-surface-1 px-4 py-3')}>
                <input type="checkbox" checked={form.noindex} onChange={set('noindex')} className="mt-1 h-4 w-4 accent-[#C8B285]" />
                <span className="flex flex-col">
                  <span className={type.calloutStrong}>Hide from search</span>
                  <span className={cn(type.caption, 'text-fg-tertiary')}>Adds noindex and leaves the post out of the sitemap.</span>
                </span>
              </label>
            </div>
            <SocialPreview form={form} countries={countries} />
          </Panel>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Panel title="Publishing">
            <div className="grid grid-cols-2 gap-1 rounded-button border border-line p-1" role="radiogroup" aria-label="Status">
              {(['draft', 'published'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={form.status === item}
                  disabled={item === 'published' && !canPublish}
                  onClick={() => setForm({ ...form, status: item })}
                  className={cn(
                    type.calloutStrong,
                    'h-9 rounded-[4px] capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    form.status === item ? 'bg-fg text-fg-inverse' : 'text-fg-secondary hover:text-fg',
                    focusRing,
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            {!canPublish ? <p className={cn(type.caption, 'text-fg-tertiary')}>Support staff save drafts. An admin publishes them.</p> : null}
            <label className="flex flex-col gap-2">
              <Label hint="Empty publishes now. A future time schedules the post.">Publish time</Label>
              <input type="datetime-local" value={form.published_at} onChange={set('published_at')} className={cn(input, '[color-scheme:dark]')} />
            </label>
            <label className="flex flex-col gap-2">
              <Label>Language</Label>
              <select value={form.locale} onChange={set('locale')} className={input}>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </label>
            <TextField
              label={`${form.locale === 'en' ? 'Arabic' : 'English'} version slug`}
              value={form.alternate_slug}
              onChange={set('alternate_slug')}
              placeholder={form.locale === 'en' ? 'tathbit-esim-iphone' : 'install-esim-iphone'}
              hint="Links the translations for hreflang and the language switch."
            />
            {post ? (
              <p className={cn(type.caption, 'text-fg-tertiary')}>
                Created {when(post.created_at)} · updated {when(post.updated_at)}
              </p>
            ) : null}
            {id && role === 'admin' ? (
              <Button variant="ghost" size="sm" onClick={() => void remove()} disabled={busy} className="self-start text-danger hover:bg-danger-tint">
                Delete post
              </Button>
            ) : null}
          </Panel>

          <Panel title="SEO checks" aside={<span className={cn(type.dataMd, scoreTone(score))}>{score}</span>}>
            <div className="h-1.5 overflow-hidden rounded-pill bg-surface-3" aria-hidden>
              <div className={cn('h-full rounded-pill transition-[width] duration-base ease-vela', score >= 80 ? 'bg-success' : score >= 55 ? 'bg-warning' : 'bg-danger')} style={{ width: `${score}%` }} />
            </div>
            <ul className="flex flex-col gap-3">
              {checks.map((check) => (
                <Check key={check.id} check={check} />
              ))}
            </ul>
          </Panel>

          <Panel title="Details">
            <TextField label="Author" value={form.author_name} onChange={set('author_name')} />
            <TextField label="Author role" value={form.author_role} onChange={set('author_role')} placeholder="Travel desk" />
            <TextField label="Tags" value={form.tags} onChange={set('tags')} placeholder="Guides, iPhone" hint="Comma separated. The first shows on cards." />
            <TextField label="Countries" value={form.country_codes} onChange={set('country_codes')} placeholder="JP, TH" hint="Two-letter codes. Adds a plans box linking to those destinations." />
          </Panel>
        </aside>
      </div>
    </form>
  );
}

export const input = cn(type.body, 'h-button w-full rounded-button border border-line bg-surface-1 px-4 text-fg outline-none transition-colors placeholder:text-fg-quaternary focus:border-accent/60');

export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card as="section" className="flex flex-col gap-5 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className={type.title}>{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export function Label({ children, hint, count }: { children: ReactNode; hint?: string; count?: [number, number] }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className={cn(type.calloutStrong, 'text-fg')}>{children}</span>
        {count ? <span className={cn(type.caption, 'tabular-nums', count[0] > count[1] ? 'text-danger' : 'text-fg-tertiary')}>{`${count[0]} / ${count[1]}`}</span> : null}
      </span>
      {hint ? <span className={cn(type.caption, 'text-fg-tertiary')}>{hint}</span> : null}
    </span>
  );
}

export function TextField({
  label,
  hint,
  ...rest
}: { label: string; hint?: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <Label hint={hint}>{label}</Label>
      <input {...rest} className={input} />
    </label>
  );
}

export function Check({ check }: { check: SeoCheck }) {
  const mark = { good: '✓', warn: '!', bad: '×' }[check.state];
  const colour = { good: 'bg-success-tint text-success', warn: 'bg-warning-tint text-warning', bad: 'bg-danger-tint text-danger' }[check.state];
  return (
    <li className="flex gap-3">
      <span aria-hidden className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-[12px] font-sans-semibold', colour)}>
        {mark}
      </span>
      <span className="flex flex-col">
        <span className={cn(type.callout, 'text-fg')}>
          <span className="sr-only">{check.state === 'good' ? 'Passed: ' : check.state === 'warn' ? 'Could improve: ' : 'Problem: '}</span>
          {check.label}
        </span>
        {check.state !== 'good' ? <span className={cn(type.caption, 'text-fg-tertiary')}>{check.hint}</span> : null}
      </span>
    </li>
  );
}

/** Roughly how the post shows in Google's results (dark theme). */
function SearchPreview({ form }: { form: Form }) {
  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const title = effectiveTitle(form);
  const description = effectiveDescription(form);
  return (
    <div className="flex flex-col gap-2">
      <span className={cn(type.labelSm, 'text-fg-tertiary')}>Search preview</span>
      <div className="flex flex-col gap-1 rounded-button border border-line bg-[#202124] p-4" dir={form.locale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3" dir="ltr">
          <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-[#303134] text-[12px] text-fg">v</span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] leading-5 text-[#dadce0]">vela</span>
            <span className="truncate text-[12px] leading-4 text-[#bdc1c6]">
              {host} › {form.locale} › blog › {form.slug || '…'}
            </span>
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-[20px] leading-[26px] text-[#99c3ff]">{title}</p>
        <p className="line-clamp-2 text-[14px] leading-[22px] text-[#bdc1c6]">{description || 'Add an excerpt or meta description.'}</p>
      </div>
      {form.noindex ? <p className={cn(type.caption, 'text-warning')}>Hidden from search: this preview won’t appear in results.</p> : null}
    </div>
  );
}

/** Link card as WhatsApp, LinkedIn and X show it. */
function SocialPreview({ form, countries }: { form: Form; countries: string[] }) {
  const image = form.og_image || form.cover_image;
  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <div className="flex flex-col gap-2">
      <span className={cn(type.labelSm, 'text-fg-tertiary')}>Social preview</span>
      <div className="max-w-[520px] overflow-hidden rounded-card-lg border border-line bg-surface-2" dir={form.locale === 'ar' ? 'rtl' : 'ltr'}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview of an editor-supplied URL
          <img src={image} alt="" className="aspect-[1200/630] w-full object-cover" />
        ) : (
          <PostCover post={{ cover_image: null, cover_alt: '', country_codes: countries }} ratio="aspect-[1200/630]" className="rounded-none border-0" />
        )}
        <div className="flex flex-col gap-1 border-t border-line px-4 py-3">
          <span className="text-[12px] uppercase tracking-wide text-fg-tertiary" dir="ltr">
            {host}
          </span>
          <span className={cn(type.calloutStrong, 'line-clamp-1 text-fg')}>{effectiveTitle(form)}</span>
          <span className={cn(type.caption, 'line-clamp-2 text-fg-secondary')}>{effectiveDescription(form)}</span>
        </div>
      </div>
      {!image && form.locale === 'en' ? <p className={cn(type.caption, 'text-fg-tertiary')}>Once published, English posts without an image get a generated card with the title.</p> : null}
    </div>
  );
}
