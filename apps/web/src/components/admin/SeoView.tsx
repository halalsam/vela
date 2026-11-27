'use client';

import { type SeoChangeFrequency, type SeoPage, type SeoSite } from '@vela/api';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button, Card, Pill, focusRing } from '@/components/ui';
import { adminFetch, when, type AdminSeo } from '@/lib/adminApi';
import type { Locale } from '@/lib/i18n';
import {
  DEFAULT_TITLE_TEMPLATE,
  DESCRIPTION_RANGE,
  resolveSeo,
  seoPageChecks,
  seoPageDef,
  seoPageDefs,
  seoScore,
  TITLE_RANGE,
  type ResolvedSeo,
  type SeoCheck,
  type SeoDefaults,
  type SeoGroup,
} from '@/lib/seoCore';
import { isImageUrl } from '@/lib/adminApi';
import { siteUrl } from '@/lib/site';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';
import { Check, input, Label, Panel, TextField } from './BlogEditor';
import { ImageField } from './ImageField';
import { scoreTone } from './BlogListView';

export type SeoAdminDefaults = {
  /** Keyed "<page key>:<locale>". */
  pages: Record<string, SeoDefaults>;
  destinations: { slug: string; name: { en: string; ar: string }; price: string; countries: number; region: boolean }[];
};

type View = { kind: 'overview' } | { kind: 'site' } | { kind: 'inspect'; path?: string } | { kind: 'page'; key: string };

const LOCALES: Locale[] = ['en', 'ar'];
const GROUPS: SeoGroup[] = ['Main', 'Destinations', 'Content', 'Help', 'Legal'];
const FREQUENCIES: SeoChangeFrequency[] = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

type Rows = Record<string, SeoPage>;
const rowId = (key: string, locale: Locale) => `${key}|${locale}`;

/** Everything needed to resolve one page key in one language, the same way the website does. */
function context(key: string, locale: Locale, rows: Rows, defaults: SeoAdminDefaults) {
  const item = key.startsWith('destination:');
  const baseKey = item ? 'destination' : key;
  const def = seoPageDef(key);
  const destination = item ? defaults.destinations.find((d) => `destination:${d.slug}` === key) : (defaults.destinations.find((d) => d.slug === 'jp') ?? defaults.destinations[0]);
  const vars: Record<string, string> = destination ? { name: destination.name[locale], price: destination.price, countries: String(destination.countries) } : {};
  const path = baseKey === 'destination' ? `/destinations/${destination?.slug ?? 'jp'}` : (def?.path ?? '');
  return {
    item,
    baseKey,
    def,
    vars,
    path,
    page: rows[rowId(baseKey, locale)] ?? null,
    itemRow: item ? (rows[rowId(key, locale)] ?? null) : null,
    defaults: defaults.pages[`${baseKey}:${locale}`] ?? { title: '', description: '' },
    destination,
  };
}

function resolveKey(key: string, locale: Locale, rows: Rows, site: SeoSite, defaults: SeoAdminDefaults): ResolvedSeo {
  const c = context(key, locale, rows, defaults);
  return resolveSeo({ locale, site, page: c.page, item: c.itemRow, def: c.def, defaults: c.defaults, vars: c.vars });
}

/** Every page key the site has: fixed pages plus destinations that have their own override. */
function allKeys(rows: Rows) {
  const items = [...new Set(Object.values(rows).map((row) => row.key))].filter((key) => key.startsWith('destination:')).sort();
  return [...seoPageDefs.map((def) => def.key), ...items];
}

function checksFor(key: string, locale: Locale, rows: Rows, site: SeoSite, defaults: SeoAdminDefaults, override?: { row: SeoPage | null }) {
  const effectiveRows = override ? { ...rows } : rows;
  if (override) {
    if (override.row) effectiveRows[rowId(key, locale)] = override.row;
    else delete effectiveRows[rowId(key, locale)];
  }
  const resolved = resolveKey(key, locale, effectiveRows, site, defaults);
  const others = allKeys(effectiveRows)
    .filter((other) => other !== key && other !== 'destination' && !(key === 'destination' && other.startsWith('destination:')))
    .map((other) => resolveKey(other, locale, effectiveRows, site, defaults));
  const c = context(key, locale, effectiveRows, defaults);
  const own = c.item ? c.itemRow : c.page;
  const checks = seoPageChecks(resolved, {
    rawTitle: own?.meta_title ?? c.page?.meta_title ?? c.defaults.title,
    rawDescription: own?.meta_description ?? c.page?.meta_description ?? c.defaults.description,
    vars: c.def?.vars ?? [],
    otherTitles: others.map((other) => other.fullTitle),
    otherDescriptions: others.map((other) => other.description),
    structuredData: own?.structured_data,
  });
  return { resolved, checks, score: seoScore(checks) };
}

export function SeoView({ defaults }: { defaults: SeoAdminDefaults }) {
  const [data, setData] = useState<AdminSeo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'overview' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminSeo>('/v1/admin/seo').then(
      (result) => !cancelled && setData(result),
      (caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : 'Couldn’t load SEO settings'),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Rows = useMemo(() => Object.fromEntries((data?.pages ?? []).map((row) => [rowId(row.key, row.locale), row])), [data]);

  if (error) return <p className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>{error}</p>;
  if (!data) return <div className="h-[70vh] animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" aria-busy />;

  const site = data.site;
  const savePage = (row: SeoPage | null, key: string, locale: Locale) =>
    setData((current) => {
      if (!current) return current;
      const pages = current.pages.filter((item) => !(item.key === key && item.locale === locale));
      return { ...current, pages: row ? [...pages, row] : pages };
    });
  const overridden = new Set(Object.values(rows).map((row) => row.key));
  const matches = defaults.destinations.filter((d) => {
    const q = search.trim().toLowerCase();
    return !q || d.slug.includes(q) || d.name.en.toLowerCase().includes(q) || d.name.ar.includes(q);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={type.displayMd}>SEO</h1>
          <p className={cn(type.callout, 'text-fg-secondary')}>Titles, descriptions, social cards and search settings for every page. Empty fields use the site’s built-in text.</p>
        </div>
        {!site.indexing ? <Pill tone="danger">Whole site hidden from search</Pill> : null}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="SEO pages" className="flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="flex flex-col gap-1">
            <NavItem active={view.kind === 'overview'} onClick={() => setView({ kind: 'overview' })}>
              Overview
            </NavItem>
            <NavItem active={view.kind === 'inspect'} onClick={() => setView({ kind: 'inspect' })}>
              Inspect a live page
            </NavItem>
            <NavItem active={view.kind === 'site'} onClick={() => setView({ kind: 'site' })}>
              Site settings
            </NavItem>
          </div>
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-1">
              <span className={cn(type.labelSm, 'px-3 text-fg-tertiary')}>{group}</span>
              {seoPageDefs
                .filter((def) => def.group === group)
                .map((def) => (
                  <NavItem key={def.key} active={view.kind === 'page' && view.key === def.key} onClick={() => setView({ kind: 'page', key: def.key })} marked={overridden.has(def.key)}>
                    {def.label}
                  </NavItem>
                ))}
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <span className={cn(type.labelSm, 'px-3 text-fg-tertiary')}>Single destinations</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search countries and regions" className={cn(input, 'h-10 text-[14px]')} />
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {matches.slice(0, 60).map((d) => {
                const key = `destination:${d.slug}`;
                return (
                  <NavItem key={key} active={view.kind === 'page' && view.key === key} onClick={() => setView({ kind: 'page', key })} marked={overridden.has(key)}>
                    {d.name.en}
                    <span className="ms-1 text-fg-quaternary">{d.region ? 'region' : d.slug.toUpperCase()}</span>
                  </NavItem>
                );
              })}
            </div>
          </div>
          <p className={cn(type.caption, 'px-3 text-fg-tertiary')}>● has custom settings</p>
        </nav>

        <div className="min-w-0">
          {view.kind === 'overview' ? <Overview rows={rows} site={site} defaults={defaults} open={(key) => setView({ kind: 'page', key })} /> : null}
          {view.kind === 'site' ? <SiteEditor site={site} onSaved={(next) => setData({ ...data, site: next })} /> : null}
          {view.kind === 'inspect' ? <Inspector initialPath={view.path} /> : null}
          {view.kind === 'page' ? (
            <PageEditor
              key={view.key}
              pageKey={view.key}
              rows={rows}
              site={site}
              defaults={defaults}
              onSaved={savePage}
              inspect={(path) => setView({ kind: 'inspect', path })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, marked, children }: { active: boolean; onClick: () => void; marked?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(type.callout, 'flex items-center justify-between gap-2 rounded-button px-3 py-2 text-start', active ? 'bg-surface-2 text-fg' : 'text-fg-secondary hover:bg-surface-1 hover:text-fg', focusRing)}
    >
      <span className="truncate">{children}</span>
      {marked ? <span aria-label="custom settings" className="text-accent">●</span> : null}
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return <span className={cn(type.dataMd, 'tabular-nums', scoreTone(score))}>{score}</span>;
}

// Overview: every page in both languages with its score and its worst problem.

function Overview({ rows, site, defaults, open }: { rows: Rows; site: SeoSite; defaults: SeoAdminDefaults; open: (key: string) => void }) {
  const results = useMemo(
    () =>
      allKeys(rows).map((key) => ({
        key,
        label: seoPageDef(key)?.key === 'destination' && key !== 'destination' ? `${defaults.destinations.find((d) => `destination:${d.slug}` === key)?.name.en ?? key}` : (seoPageDef(key)?.label ?? key),
        locales: LOCALES.map((locale) => ({ locale, custom: Boolean(rows[rowId(key, locale)]), ...checksFor(key, locale, rows, site, defaults) })),
      })),
    [rows, site, defaults],
  );
  const flat = results.flatMap((result) => result.locales);
  const average = Math.round(flat.reduce((sum, item) => sum + item.score, 0) / Math.max(flat.length, 1));
  const problems = flat.reduce((sum, item) => sum + item.checks.filter((check) => check.state === 'bad').length, 0);
  const hidden = flat.filter((item) => item.resolved.noindex).length;
  const custom = flat.filter((item) => item.custom).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Average score" value={<ScoreBadge score={average} />} />
        <Stat label="Problems to fix" value={<span className={cn(type.dataMd, problems ? 'text-danger' : 'text-success')}>{problems}</span>} />
        <Stat label="Hidden from search" value={<span className={cn(type.dataMd, hidden ? 'text-warning' : 'text-fg')}>{hidden}</span>} />
        <Stat label="Pages with custom SEO" value={<span className={type.dataMd}>{custom}</span>} />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-start">
          <thead>
            <tr className={cn(type.labelSm, 'border-b border-line text-fg-tertiary')}>
              <th className="px-4 py-3 text-start font-normal">Page</th>
              {LOCALES.map((locale) => (
                <th key={locale} className="px-4 py-3 text-start font-normal">
                  {locale === 'en' ? 'English' : 'Arabic'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.map((result) => (
              <tr key={result.key} className="cursor-pointer hover:bg-surface-1" onClick={() => open(result.key)}>
                <td className="px-4 py-3 align-top">
                  <button type="button" onClick={() => open(result.key)} className={cn(type.calloutStrong, 'rounded-chip text-start text-fg', focusRing)}>
                    {result.label}
                  </button>
                  <div className={cn(type.caption, 'text-fg-tertiary')}>{result.key}</div>
                </td>
                {result.locales.map((item) => {
                  const worst = item.checks.find((check) => check.state === 'bad') ?? item.checks.find((check) => check.state === 'warn');
                  return (
                    <td key={item.locale} className="px-4 py-3 align-top">
                      <div className="flex items-baseline gap-2">
                        <ScoreBadge score={item.score} />
                        {item.custom ? <Pill tone="accent">custom</Pill> : <span className={cn(type.caption, 'text-fg-quaternary')}>default</span>}
                        {item.resolved.noindex ? <Pill tone="warning">noindex</Pill> : null}
                      </div>
                      <p className={cn(type.caption, 'mt-1 line-clamp-1 text-fg-secondary')} dir={item.locale === 'ar' ? 'rtl' : 'ltr'}>
                        {item.resolved.fullTitle}
                      </p>
                      {worst ? <p className={cn(type.caption, worst.state === 'bad' ? 'text-danger' : 'text-warning')}>{worst.label}</p> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <span className={cn(type.caption, 'text-fg-tertiary')}>{label}</span>
      {value}
    </Card>
  );
}

// Page editor.

type PageForm = {
  meta_title: string;
  meta_description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  og_image: string;
  og_image_alt: string;
  canonical_url: string;
  noindex: boolean;
  nofollow: boolean;
  sitemap_priority: string;
  change_frequency: string;
  structured_data: string;
};

const blankPage: PageForm = {
  meta_title: '',
  meta_description: '',
  keywords: '',
  og_title: '',
  og_description: '',
  og_image: '',
  og_image_alt: '',
  canonical_url: '',
  noindex: false,
  nofollow: false,
  sitemap_priority: '',
  change_frequency: '',
  structured_data: '',
};

const split = (value: string, by: RegExp = /,/) =>
  value
    .split(by)
    .map((item) => item.trim())
    .filter(Boolean);

function toPageForm(row: SeoPage | null): PageForm {
  if (!row) return blankPage;
  return {
    meta_title: row.meta_title ?? '',
    meta_description: row.meta_description ?? '',
    keywords: row.keywords.join(', '),
    og_title: row.og_title ?? '',
    og_description: row.og_description ?? '',
    og_image: row.og_image ?? '',
    og_image_alt: row.og_image_alt ?? '',
    canonical_url: row.canonical_url ?? '',
    noindex: row.noindex,
    nofollow: row.nofollow,
    sitemap_priority: row.sitemap_priority === null ? '' : String(row.sitemap_priority),
    change_frequency: row.change_frequency ?? '',
    structured_data: row.structured_data ?? '',
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

function toRow(form: PageForm, key: string, locale: Locale): SeoPage {
  return {
    key,
    locale,
    meta_title: orNull(form.meta_title),
    meta_description: orNull(form.meta_description),
    keywords: split(form.keywords).map((word) => word.toLowerCase()),
    og_title: orNull(form.og_title),
    og_description: orNull(form.og_description),
    og_image: orNull(form.og_image),
    og_image_alt: orNull(form.og_image_alt),
    canonical_url: orNull(form.canonical_url),
    noindex: form.noindex,
    nofollow: form.nofollow,
    sitemap_priority: form.sitemap_priority ? Number(form.sitemap_priority) : null,
    change_frequency: (orNull(form.change_frequency) as SeoChangeFrequency | null) ?? null,
    structured_data: orNull(form.structured_data),
    updated_at: new Date().toISOString(),
  };
}

function pageProblems(form: PageForm): string[] {
  const out: string[] = [];
  if (form.canonical_url && !/^https:\/\//.test(form.canonical_url)) out.push('The canonical URL must start with https://.');
  if (form.og_image && !isImageUrl(form.og_image)) out.push('The social image must be an https:// URL or a path starting with /.');
  if (form.structured_data.trim()) {
    try {
      const parsed: unknown = JSON.parse(form.structured_data);
      if (typeof parsed !== 'object' || parsed === null) out.push('Structured data must be a JSON object or array.');
    } catch {
      out.push('Structured data isn’t valid JSON.');
    }
  }
  return out;
}

function PageEditor({
  pageKey,
  rows,
  site,
  defaults,
  onSaved,
  inspect,
}: {
  pageKey: string;
  rows: Rows;
  site: SeoSite;
  defaults: SeoAdminDefaults;
  onSaved: (row: SeoPage | null, key: string, locale: Locale) => void;
  inspect: (path: string) => void;
}) {
  const role = useStaffRole();
  const [locale, setLocale] = useState<Locale>('en');
  const saved = rows[rowId(pageKey, locale)] ?? null;
  const [form, setForm] = useState<PageForm>(() => toPageForm(saved));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  const savedForm = toPageForm(saved);
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const switchLocale = (next: Locale) => {
    if (dirty && !window.confirm('Discard unsaved changes for this language?')) return;
    setLocale(next);
    setForm(toPageForm(rows[rowId(pageKey, next)] ?? null));
    setError(null);
    setNotice(null);
  };

  const c = context(pageKey, locale, rows, defaults);
  const draft = toRow(form, pageKey, locale);
  const empty = JSON.stringify(form) === JSON.stringify(blankPage);
  const { resolved, checks, score } = checksFor(pageKey, locale, rows, site, defaults, { row: empty ? null : draft });
  // What each field shows when left empty: the same page resolved without this row.
  const fallback = checksFor(pageKey, locale, rows, site, defaults, { row: null }).resolved;
  const rtl = locale === 'ar';
  const livePath = `/${locale}${c.path}`;
  const canEdit = role === 'admin';
  const label = c.item ? `${c.destination?.name.en ?? pageKey}` : (c.def?.label ?? pageKey);
  const set =
    <K extends keyof PageForm>(field: K) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = (event.target instanceof HTMLInputElement && event.target.type === 'checkbox' ? event.target.checked : event.target.value) as PageForm[K];
      setForm((current) => ({ ...current, [field]: value }));
    };

  async function save() {
    const issues = pageProblems(form);
    if (issues.length > 0) return setError(issues.join(' '));
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body: Partial<SeoPage> = { ...draft };
      delete body.key;
      delete body.locale;
      delete body.updated_at;
      const result = await adminFetch<SeoPage>(`/v1/admin/seo/pages/${encodeURIComponent(pageKey)}/${locale}`, { method: 'PUT', body });
      onSaved(result, pageKey, locale);
      setForm(toPageForm(result));
      setNotice('Saved. The website picks it up within about two minutes.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(`Clear every custom field for ${label} (${locale === 'en' ? 'English' : 'Arabic'})? The page goes back to its built-in text.`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/v1/admin/seo/pages/${encodeURIComponent(pageKey)}/${locale}`, { method: 'DELETE' });
      onSaved(null, pageKey, locale);
      setForm(blankPage);
      setNotice('Back to defaults.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t reset');
    } finally {
      setBusy(false);
    }
  }

  const vars = c.def?.vars ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <h2 className={type.displayMd}>{label}</h2>
          <span className={cn(type.caption, 'text-fg-tertiary')} dir="ltr">
            {host}
            {c.item || c.baseKey !== 'destination' ? livePath : `/${locale}/destinations/{slug}`}
          </span>
        </div>
        <div role="tablist" aria-label="Language" className="ms-auto flex rounded-pill border border-line p-0.5">
          {LOCALES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={locale === item}
              onClick={() => switchLocale(item)}
              className={cn(type.caption, 'rounded-pill px-3 py-1', locale === item ? 'bg-surface-3 text-fg' : 'text-fg-tertiary hover:text-fg', focusRing)}
            >
              {item === 'en' ? 'English' : 'Arabic'}
              {rows[rowId(pageKey, item)] ? ' ●' : ''}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => inspect(livePath)}>
          Inspect live
        </Button>
        <a href={livePath} target="_blank" rel="noopener noreferrer" className={cn(type.calloutStrong, 'rounded-button px-4 py-2 text-fg-secondary hover:bg-surface-2 hover:text-fg', focusRing)}>
          View ↗
        </a>
        <Button onClick={() => void save()} disabled={busy || !dirty || !canEdit}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div aria-live="polite" className="contents">
        {c.def?.note ? <p className={cn(type.callout, 'text-fg-secondary')}>{c.def.note}</p> : null}
        {c.item ? <p className={cn(type.callout, 'text-fg-secondary')}>Fields left empty use the destination template, then the built-in text.</p> : null}
        {!canEdit ? <p className={cn(type.callout, 'rounded-button bg-warning-tint px-4 py-3 text-warning')}>Only admins can change SEO settings.</p> : null}
        {error ? (
          <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
            {error}
          </p>
        ) : null}
        {notice ? <p className={cn(type.callout, 'rounded-button bg-success-tint px-4 py-3 text-success')}>{notice}</p> : null}
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6 2xl:order-first">
          <Panel title="Previews">
            <SearchPreview resolved={resolved} path={livePath} rtl={rtl} device={device} setDevice={setDevice} siteName={resolved.siteName} />
            <SocialPreviews resolved={resolved} rtl={rtl} />
          </Panel>

          <Panel title="Search">
            {vars.length > 0 ? (
              <p className={cn(type.caption, 'rounded-button bg-surface-2 px-3 py-2 text-fg-secondary')}>
                Placeholders: {vars.map((name) => `{{${name}}}`).join(', ')}. The previews fill them in for {c.destination?.name[locale] ?? 'a destination'}.
              </p>
            ) : null}
            <label className="flex flex-col gap-2">
              <Label count={[resolved.fullTitle.length, TITLE_RANGE[1]]} hint={c.def?.absoluteTitle ? 'Used exactly as written.' : `The title template (${site.title_template ?? DEFAULT_TITLE_TEMPLATE}) is added for you.`}>
                Meta title
              </Label>
              <input value={form.meta_title} onChange={set('meta_title')} maxLength={90} dir={rtl ? 'rtl' : 'ltr'} placeholder={rawPlaceholder(c, 'meta_title', fallback.title)} className={input} />
            </label>
            <label className="flex flex-col gap-2">
              <Label count={[resolved.description.length, DESCRIPTION_RANGE[1]]} hint="What the visitor gets from this page, in one or two sentences.">
                Meta description
              </Label>
              <textarea value={form.meta_description} onChange={set('meta_description')} rows={3} maxLength={320} dir={rtl ? 'rtl' : 'ltr'} placeholder={rawPlaceholder(c, 'meta_description', fallback.description)} className={cn(input, 'h-auto min-h-[96px] py-3')} />
            </label>
            <TextField label="Keywords" value={form.keywords} onChange={set('keywords')} placeholder={fallback.keywords.join(', ') || 'japan esim, travel esim japan'} hint="Comma separated. The first is the focus keyword for the checks." />
          </Panel>

          <Panel title="Social sharing">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Social title" value={form.og_title} onChange={set('og_title')} placeholder={fallback.ogTitle} hint="Empty uses the meta title." />
              <div className="md:col-span-2">
                <ImageField
                  label="Social image"
                  value={form.og_image}
                  onValue={(url) => setForm((current) => ({ ...current, og_image: url }))}
                  onAlt={(alt) => setForm((current) => (current.og_image_alt ? current : { ...current, og_image_alt: alt }))}
                  placeholder={fallback.image}
                  hint="1200×630 JPG or PNG. Empty uses the default."
                  recommend={{ width: 1200, height: 630 }}
                />
              </div>
              <label className="flex flex-col gap-2 md:col-span-2">
                <Label hint="Empty uses the meta description.">Social description</Label>
                <textarea value={form.og_description} onChange={set('og_description')} rows={3} maxLength={320} dir={rtl ? 'rtl' : 'ltr'} placeholder={fallback.ogDescription} className={cn(input, 'h-auto min-h-[96px] py-3')} />
              </label>
              <div className="md:col-span-2">
                <TextField label="Social image alt text" value={form.og_image_alt} onChange={set('og_image_alt')} placeholder={fallback.imageAlt} />
              </div>
            </div>
          </Panel>

          <Panel title="Indexing and sitemap">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle checked={form.noindex} onChange={set('noindex')} title="Hide from search" body="Adds noindex and leaves the page out of the sitemap." />
              <Toggle checked={form.nofollow} onChange={set('nofollow')} title="Don’t follow links" body="Adds nofollow. Rarely needed." />
              <div className="md:col-span-2">
                <TextField label="Canonical URL" value={form.canonical_url} onChange={set('canonical_url')} placeholder={`${siteUrl}${livePath}`} hint="Only to send search engines to a different URL." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
                <label className="flex flex-col gap-2">
                  <Label hint={`Default ${c.def?.priority ?? 0.5}`}>Sitemap priority</Label>
                  <select value={form.sitemap_priority} onChange={set('sitemap_priority')} className={input}>
                    <option value="">Default</option>
                    {[1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1].map((value) => (
                      <option key={value} value={String(value)}>
                        {value.toFixed(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <Label hint={`Default ${c.def?.changeFrequency ?? 'weekly'}`}>Changes</Label>
                  <select value={form.change_frequency} onChange={set('change_frequency')} className={input}>
                    <option value="">Default</option>
                    {FREQUENCIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </Panel>

          <Panel title="Extra structured data">
            <label className="flex flex-col gap-2">
              <Label hint="JSON-LD added next to what the page already emits (breadcrumbs, FAQ, product, organisation). Paste an object or array, without <script>.">JSON-LD</Label>
              <textarea
                value={form.structured_data}
                onChange={set('structured_data')}
                rows={6}
                spellCheck={false}
                placeholder={'{\n  "@type": "Service",\n  "name": "Travel eSIM"\n}'}
                className={cn(input, 'h-auto min-h-[160px] py-3 font-mono text-[13px] leading-5')}
                dir="ltr"
              />
            </label>
          </Panel>
        </div>

        <aside className="grid items-start gap-6 md:grid-cols-2 2xl:order-last 2xl:sticky 2xl:top-6 2xl:grid-cols-1">
          <Panel title="SEO checks" aside={<ScoreBadge score={score} />}>
            <ScoreBar score={score} />
            <CheckList checks={checks} />
          </Panel>
          <Panel title="Where the text comes from">
            <ul className={cn(type.caption, 'flex flex-col gap-2 text-fg-secondary')}>
              <li>Title: {layerName(resolved.source.title)}</li>
              <li>Description: {layerName(resolved.source.description)}</li>
              <li>Social image: {layerName(resolved.source.image)}</li>
            </ul>
            {saved ? (
              <>
                <p className={cn(type.caption, 'text-fg-tertiary')}>Last saved {when(saved.updated_at)}</p>
                {canEdit ? (
                  <Button variant="ghost" size="sm" onClick={() => void reset()} disabled={busy} className="self-start text-danger hover:bg-danger-tint">
                    Reset to defaults
                  </Button>
                ) : null}
              </>
            ) : (
              <p className={cn(type.caption, 'text-fg-tertiary')}>Nothing saved yet: the page uses its defaults.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

const layerName = (layer: string) => ({ item: 'this destination', page: 'this page’s settings', default: 'the site’s built-in text', site: 'site settings' })[layer] ?? layer;

/** Placeholder text: for a template page, the raw template with {{placeholders}}; otherwise the resolved fallback. */
function rawPlaceholder(c: ReturnType<typeof context>, field: 'meta_title' | 'meta_description', resolved: string) {
  if (c.baseKey === 'destination' && !c.item) return (field === 'meta_title' ? c.defaults.title : c.defaults.description) || resolved;
  return resolved;
}

function Toggle({ checked, onChange, title, body }: { checked: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; title: string; body: string }) {
  return (
    <label className="flex items-start gap-3 rounded-button border border-line bg-surface-1 px-4 py-3">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-[#C8B285]" />
      <span className="flex flex-col">
        <span className={type.calloutStrong}>{title}</span>
        <span className={cn(type.caption, 'text-fg-tertiary')}>{body}</span>
      </span>
    </label>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-pill bg-surface-3" aria-hidden>
      <div className={cn('h-full rounded-pill transition-[width] duration-base ease-vela', score >= 80 ? 'bg-success' : score >= 55 ? 'bg-warning' : 'bg-danger')} style={{ width: `${score}%` }} />
    </div>
  );
}

function CheckList({ checks }: { checks: SeoCheck[] }) {
  const order = { bad: 0, warn: 1, good: 2 };
  return (
    <ul className="flex flex-col gap-3">
      {[...checks]
        .sort((a, b) => order[a.state] - order[b.state])
        .map((check) => (
          <Check key={check.id} check={check} />
        ))}
    </ul>
  );
}

// Previews.

function SearchPreview({
  resolved,
  path,
  rtl,
  device,
  setDevice,
  siteName,
}: {
  resolved: ResolvedSeo;
  path: string;
  rtl: boolean;
  device: 'desktop' | 'mobile';
  setDevice: (device: 'desktop' | 'mobile') => void;
  siteName: string;
}) {
  const crumbs = path.split('/').filter(Boolean).join(' › ');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={cn(type.labelSm, 'text-fg-tertiary')}>Google result</span>
        <div className="flex rounded-pill border border-line p-0.5">
          {(['desktop', 'mobile'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDevice(item)}
              aria-pressed={device === item}
              className={cn(type.caption, 'rounded-pill px-3 py-0.5 capitalize', device === item ? 'bg-surface-3 text-fg' : 'text-fg-tertiary hover:text-fg', focusRing)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className={cn('flex flex-col gap-1 rounded-button border border-line bg-[#202124] p-4', device === 'mobile' ? 'max-w-[380px]' : 'max-w-[640px]')} dir={rtl ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3" dir="ltr">
          <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-[#303134] text-[12px] text-fg">{siteName.slice(0, 1)}</span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] leading-5 text-[#dadce0]">{siteName}</span>
            <span className="truncate text-[12px] leading-4 text-[#bdc1c6]">
              {host} › {crumbs}
            </span>
          </span>
        </div>
        <p className={cn('mt-1 text-[#99c3ff]', device === 'mobile' ? 'line-clamp-2 text-[18px] leading-6' : 'line-clamp-1 text-[20px] leading-[26px]')}>{resolved.fullTitle}</p>
        <p className={cn('text-[14px] leading-[22px] text-[#bdc1c6]', device === 'mobile' ? 'line-clamp-3' : 'line-clamp-2')}>{resolved.description || 'No description: Google will pick text from the page.'}</p>
      </div>
      {resolved.noindex ? <p className={cn(type.caption, 'text-warning')}>Hidden from search: this result won’t appear.</p> : null}
    </div>
  );
}

function PreviewImage({ src, ratio }: { src: string; ratio: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className={cn(ratio, 'flex w-full items-center justify-center bg-surface-3 text-[12px] text-fg-tertiary')}>Image didn’t load</div>;
  // eslint-disable-next-line @next/next/no-img-element -- preview of an editor-supplied URL
  return <img src={src} alt="" onError={() => setBroken(true)} className={cn(ratio, 'w-full object-cover')} />;
}

function SocialPreviews({ resolved, rtl }: { resolved: ResolvedSeo; rtl: boolean }) {
  const image = resolved.image;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className={cn(type.labelSm, 'text-fg-tertiary')}>Facebook, LinkedIn, WhatsApp</span>
        <div className="overflow-hidden rounded-card border border-line bg-surface-2" dir={rtl ? 'rtl' : 'ltr'}>
          <PreviewImage key={image} src={image} ratio="aspect-[1200/630]" />
          <div className="flex flex-col gap-1 border-t border-line px-4 py-3">
            <span className="text-[12px] uppercase tracking-wide text-fg-tertiary" dir="ltr">
              {host}
            </span>
            <span className={cn(type.calloutStrong, 'line-clamp-2 text-fg')}>{resolved.ogTitle}</span>
            <span className={cn(type.caption, 'line-clamp-2 text-fg-secondary')}>{resolved.ogDescription}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className={cn(type.labelSm, 'text-fg-tertiary')}>X (Twitter)</span>
        <div className="relative overflow-hidden rounded-[16px] border border-line" dir={rtl ? 'rtl' : 'ltr'}>
          <PreviewImage key={image} src={image} ratio="aspect-[1200/630]" />
          <span className="absolute bottom-2 start-2 max-w-[85%] truncate rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[13px] text-white">{resolved.ogTitle}</span>
        </div>
        <span className={cn(type.caption, 'text-fg-tertiary')} dir="ltr">
          From {host}
        </span>
      </div>
    </div>
  );
}

// Site settings.

const lines = (list: string[]) => list.join('\n');

function SiteEditor({ site, onSaved }: { site: SeoSite; onSaved: (site: SeoSite) => void }) {
  const role = useStaffRole();
  const [form, setForm] = useState<SeoSite>(site);
  const [sameAs, setSameAs] = useState(lines(site.organization.same_as));
  const [disallow, setDisallow] = useState(lines(site.robots_disallow));
  const [keywords, setKeywords] = useState({ en: site.locales.en.keywords.join(', '), ar: site.locales.ar.keywords.join(', ') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canEdit = role === 'admin';

  const text = (value: string | null) => value ?? '';
  const nul = (value: string) => (value.trim() ? value : null);
  const setTop = (field: 'title_template' | 'default_og_image' | 'twitter_site') => (event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: nul(event.target.value) });
  const setOrg = (field: keyof Omit<SeoSite['organization'], 'same_as'>) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, organization: { ...form.organization, [field]: nul(event.target.value) } });
  const setVerify = (field: keyof SeoSite['verification']) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, verification: { ...form.verification, [field]: nul(event.target.value) } });
  const setLocal = (locale: Locale, field: 'site_name' | 'default_title' | 'default_description') => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, locales: { ...form.locales, [locale]: { ...form.locales[locale], [field]: nul(event.target.value) } } });

  const template = form.title_template ?? DEFAULT_TITLE_TEMPLATE;
  const checks: SeoCheck[] = [
    { id: 'template', label: template.includes('%s') ? 'Title template has %s' : 'Title template is missing %s', hint: '%s is where each page’s title goes.', state: template.includes('%s') ? 'good' : 'bad' },
    { id: 'indexing', label: form.indexing ? 'Search engines can index the site' : 'The whole site is hidden from search', hint: 'Turn indexing on before launch.', state: form.indexing ? 'good' : 'bad' },
    { id: 'image', label: form.default_og_image ? 'Custom default social image' : 'Using the built-in social image', hint: 'Pages without their own image use this one.', state: form.default_og_image ? 'good' : 'warn' },
    { id: 'google', label: form.verification.google ? 'Google Search Console verified' : 'No Google verification code', hint: 'Paste the content value of the google-site-verification tag.', state: form.verification.google ? 'good' : 'warn' },
    { id: 'bing', label: form.verification.bing ? 'Bing Webmaster verified' : 'No Bing verification code', hint: 'Paste the content value of the msvalidate.01 tag.', state: form.verification.bing ? 'good' : 'warn' },
    { id: 'social', label: `${split(sameAs, /\n/).length} social profiles`, hint: 'Linking official profiles helps Google show the brand panel.', state: split(sameAs, /\n/).length > 0 ? 'good' : 'warn' },
    { id: 'contact', label: form.organization.email || form.organization.phone ? 'Support contact set' : 'No support contact', hint: 'Shown in the Organization structured data.', state: form.organization.email || form.organization.phone ? 'good' : 'warn' },
  ];
  const score = seoScore(checks);

  async function save() {
    if (!template.includes('%s')) return setError('The title template needs %s where the page title goes.');
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        ...form,
        updated_at: undefined,
        organization: { ...form.organization, same_as: split(sameAs, /\n/) },
        robots_disallow: split(disallow, /\n/),
        locales: {
          en: { ...form.locales.en, keywords: split(keywords.en) },
          ar: { ...form.locales.ar, keywords: split(keywords.ar) },
        },
      };
      const result = await adminFetch<SeoSite>('/v1/admin/seo/site', { method: 'PUT', body });
      onSaved(result);
      setForm(result);
      setNotice('Saved. The website picks it up within about two minutes.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={type.displayMd}>Site settings</h2>
        {site.updated_at ? <span className={cn(type.caption, 'text-fg-tertiary')}>Saved {when(site.updated_at)}</span> : null}
        <Button onClick={() => void save()} disabled={busy || !canEdit} className="ms-auto">
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <div aria-live="polite" className="contents">
        {!canEdit ? <p className={cn(type.callout, 'rounded-button bg-warning-tint px-4 py-3 text-warning')}>Only admins can change SEO settings.</p> : null}
        {error ? (
          <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
            {error}
          </p>
        ) : null}
        {notice ? <p className={cn(type.callout, 'rounded-button bg-success-tint px-4 py-3 text-success')}>{notice}</p> : null}
      </div>
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6 2xl:order-first">
          <Panel title="Search engines">
            <label className={cn('flex items-start gap-3 rounded-button border px-4 py-3', form.indexing ? 'border-line bg-surface-1' : 'border-danger/50 bg-danger-tint')}>
              <input type="checkbox" checked={form.indexing} onChange={(event) => setForm({ ...form, indexing: event.target.checked })} className="mt-1 h-4 w-4 accent-[#C8B285]" />
              <span className="flex flex-col">
                <span className={type.calloutStrong}>Let search engines index the site</span>
                <span className={cn(type.caption, 'text-fg-tertiary')}>Off adds noindex to every page, empties the sitemap and blocks crawlers in robots.txt. Use it for staging only.</span>
              </span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Title template" value={text(form.title_template)} onChange={setTop('title_template')} placeholder={DEFAULT_TITLE_TEMPLATE} hint={`Preview: ${template.replace('%s', 'Help centre')}`} />
              <div className="md:col-span-2">
                <ImageField
                  label="Default social image"
                  value={text(form.default_og_image)}
                  onValue={(url) => setForm((current) => ({ ...current, default_og_image: nul(url) }))}
                  placeholder="/og.png"
                  hint="1200×630. Used when a page has none."
                  recommend={{ width: 1200, height: 630 }}
                />
              </div>
              <TextField label="X handle" value={text(form.twitter_site)} onChange={setTop('twitter_site')} placeholder="@vela" />
              <label className="flex flex-col gap-2">
                <Label hint="One path per line, e.g. /en/internal. Checkout, account, success and admin are always blocked.">Extra robots.txt blocks</Label>
                <textarea value={disallow} onChange={(event) => setDisallow(event.target.value)} rows={3} className={cn(input, 'h-auto min-h-[96px] py-3 font-mono text-[13px]')} dir="ltr" />
              </label>
            </div>
          </Panel>

          <Panel title="Verification codes">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Google Search Console" value={text(form.verification.google)} onChange={setVerify('google')} placeholder="content of google-site-verification" />
              <TextField label="Bing Webmaster Tools" value={text(form.verification.bing)} onChange={setVerify('bing')} placeholder="content of msvalidate.01" />
              <TextField label="Yandex" value={text(form.verification.yandex)} onChange={setVerify('yandex')} placeholder="content of yandex-verification" />
              <TextField label="Pinterest" value={text(form.verification.pinterest)} onChange={setVerify('pinterest')} placeholder="content of p:domain_verify" />
            </div>
          </Panel>

          <Panel title="Organisation">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Brand name" value={text(form.organization.name)} onChange={setOrg('name')} placeholder="vela" />
              <TextField label="Legal name" value={text(form.organization.legal_name)} onChange={setOrg('legal_name')} placeholder="Company name as registered" />
              <div className="md:col-span-2">
                <ImageField
                  label="Logo"
                  value={text(form.organization.logo)}
                  onValue={(url) => setForm((current) => ({ ...current, organization: { ...current.organization, logo: nul(url) } }))}
                  placeholder="/icon-512.png"
                  hint="Square, at least 512×512. Shown by Google next to the brand."
                  recommend={{ width: 512, height: 512 }}
                />
              </div>
              <TextField label="Support email" value={text(form.organization.email)} onChange={setOrg('email')} placeholder="support@…" />
              <TextField label="Support phone" value={text(form.organization.phone)} onChange={setOrg('phone')} placeholder="+91…" />
              <label className="flex flex-col gap-2">
                <Label hint="One https:// URL per line: Instagram, X, LinkedIn, App Store, Play Store.">Social profiles</Label>
                <textarea value={sameAs} onChange={(event) => setSameAs(event.target.value)} rows={4} className={cn(input, 'h-auto min-h-[120px] py-3 text-[14px]')} dir="ltr" />
              </label>
            </div>
          </Panel>

          {LOCALES.map((locale) => (
            <Panel key={locale} title={locale === 'en' ? 'English defaults' : 'Arabic defaults'}>
              <p className={cn(type.caption, 'text-fg-tertiary')}>Used by any page whose own text is missing, and by the site name in search results and link cards.</p>
              <div className="grid gap-4 md:grid-cols-2" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <TextField label="Site name" value={text(form.locales[locale].site_name)} onChange={setLocal(locale, 'site_name')} placeholder="vela" />
                <TextField label="Default title" value={text(form.locales[locale].default_title)} onChange={setLocal(locale, 'default_title')} placeholder={locale === 'en' ? 'vela · land connected.' : ''} />
                <label className="flex flex-col gap-2 md:col-span-2">
                  <Label count={[text(form.locales[locale].default_description).length, DESCRIPTION_RANGE[1]]}>Default description</Label>
                  <textarea value={text(form.locales[locale].default_description)} onChange={setLocal(locale, 'default_description')} rows={3} className={cn(input, 'h-auto min-h-[96px] py-3')} />
                </label>
                <TextField
                  label="Default keywords"
                  value={keywords[locale]}
                  onChange={(event) => setKeywords({ ...keywords, [locale]: event.target.value })}
                  placeholder="travel esim, esim india"
                  hint="Comma separated. Pages without their own keywords use these."
                />
              </div>
            </Panel>
          ))}
        </div>
        <aside className="grid items-start gap-6 md:grid-cols-2 2xl:order-last 2xl:sticky 2xl:top-6 2xl:grid-cols-1">
          <Panel title="Setup checks" aside={<ScoreBadge score={score} />}>
            <ScoreBar score={score} />
            <CheckList checks={checks} />
          </Panel>
          <Panel title="Files">
            <ul className={cn(type.callout, 'flex flex-col gap-2')}>
              {['/sitemap.xml', '/robots.txt', '/en/blog/rss.xml'].map((path) => (
                <li key={path}>
                  <a href={path} target="_blank" rel="noopener noreferrer" className={cn('text-accent hover:underline', focusRing)}>
                    {path} ↗
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

// Live page inspector.

type Inspection = {
  url: string;
  status: number;
  ms: number;
  title: string;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  hreflang: { lang: string; href: string }[];
  og: { title: string | null; description: string | null; image: string | null; type: string | null };
  twitter: { card: string | null; site: string | null };
  h1: string[];
  h2: string[];
  jsonLd: { valid: boolean; types: string[] }[];
  checks: SeoCheck[];
};

const quickPaths = ['/en', '/en/destinations', '/en/destinations/jp', '/en/blog', '/en/help', '/en/faq', '/ar', '/ar/destinations'];

function Inspector({ initialPath }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath ?? '/en');
  const [result, setResult] = useState<Inspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(target = path) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/admin/seo/inspect?path=${encodeURIComponent(target)}`, { cache: 'no-store' });
      const body = (await response.json()) as Inspection & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Inspection failed with ${response.status}`);
      setResult(body);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : 'Inspection failed');
    } finally {
      setBusy(false);
    }
  }

  // Run once for a path handed over from the page editor.
  useEffect(() => {
    if (!initialPath) return;
    const timer = setTimeout(() => void run(initialPath), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPath]);

  const score = result ? seoScore(result.checks) : 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className={type.displayMd}>Inspect a live page</h2>
        <p className={cn(type.callout, 'text-fg-secondary')}>Loads the page as a search engine sees it and checks its tags, headings, images, links and structured data.</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
        className="flex flex-wrap gap-3"
      >
        <div className={cn(input, 'flex min-w-[280px] flex-1 items-center p-0 focus-within:border-accent/60')} dir="ltr">
          <span className={cn(type.callout, 'shrink-0 ps-4 text-fg-tertiary')}>{host}</span>
          <input value={path} onChange={(event) => setPath(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent pe-4 text-fg outline-none" aria-label="Path" />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Inspect'}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {quickPaths.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setPath(item);
              void run(item);
            }}
            className={cn(type.caption, 'rounded-pill border border-line px-3 py-1 text-fg-secondary hover:text-fg', focusRing)}
          >
            {item}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-6 2xl:order-first">
            <Panel title="What search engines read">
              <dl className={cn(type.callout, 'grid gap-x-6 gap-y-3 md:grid-cols-[160px_minmax(0,1fr)]')}>
                <Row term="URL" value={result.url} />
                <Row term="Title" value={result.title || 'Not set'} />
                <Row term="Description" value={result.description ?? 'Not set'} />
                <Row term="Canonical" value={result.canonical ?? 'Not set'} />
                <Row term="Robots" value={result.robots ?? 'index, follow'} />
                <Row term="Languages" value={result.hreflang.map((item) => `${item.lang} → ${item.href}`).join('\n') || 'Not set'} />
                <Row term="Social title" value={result.og.title ?? 'Not set'} />
                <Row term="Social image" value={result.og.image ?? 'Not set'} />
                <Row term="Social type" value={[result.og.type, result.twitter.card, result.twitter.site].filter(Boolean).join(' · ') || 'Not set'} />
                <Row term="Structured data" value={result.jsonLd.map((item) => (item.valid ? item.types.join(', ') : 'invalid JSON')).join('\n') || 'Not set'} />
              </dl>
            </Panel>
            <Panel title="Headings">
              <div className="flex flex-col gap-2">
                {result.h1.map((heading, index) => (
                  <p key={`h1-${index}`} className={type.calloutStrong}>
                    <span className="me-2 text-accent">H1</span>
                    {heading}
                  </p>
                ))}
                {result.h2.map((heading, index) => (
                  <p key={`h2-${index}`} className={cn(type.callout, 'ps-6 text-fg-secondary')}>
                    <span className="me-2 text-fg-tertiary">H2</span>
                    {heading}
                  </p>
                ))}
                {result.h1.length + result.h2.length === 0 ? <p className={cn(type.callout, 'text-fg-tertiary')}>No headings found.</p> : null}
              </div>
            </Panel>
          </div>
          <aside className="2xl:order-last 2xl:sticky 2xl:top-6">
            <Panel title="Page checks" aside={<ScoreBadge score={score} />}>
              <ScoreBar score={score} />
              <CheckList checks={result.checks} />
            </Panel>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-fg-tertiary">{term}</dt>
      <dd className="whitespace-pre-line break-words text-fg">{value}</dd>
    </>
  );
}

