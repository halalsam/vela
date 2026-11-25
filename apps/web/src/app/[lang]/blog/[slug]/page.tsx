import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { brandName } from '@vela/brand';
import { Flag } from '@/components/esim';
import { BlogCta } from '@/components/sections/blog/BlogCta';
import { Markdown } from '@/components/sections/blog/Markdown';
import { PostCard, PostCover } from '@/components/sections/blog/PostCards';
import { Arrow } from '@/components/sections/destinations/cards';
import { LocalFrom } from '@/components/sections/LocalFrom';
import { cardLink, Container, focusRing } from '@/components/ui';
import { blogPath, breadcrumbLd, formatDate, ldJson, loadPost, loadPosts, outline, postLd, socialImage } from '@/lib/blog';
import { loadCatalog, summarizeCountry } from '@/lib/destinations';
import { format, isLocale, locales, path, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { loadSite } from '@/lib/seo';
import { getDictionary } from '../../dictionaries';

export const revalidate = 300;

export async function generateStaticParams() {
  const lists = await Promise.all(locales.map(async (lang) => (await loadPosts(lang)).map((post) => ({ lang, slug: post.slug }))));
  return lists.flat();
}

// One fetch per request for both generateMetadata and the page.
const resolve = cache(async (lang: string, slug: string) => {
  if (!isLocale(lang)) return null;
  const post = await loadPost(lang, slug);
  return post ? { post, locale: lang as Locale } : null;
});

// hreflang only when the other-language version is actually live, so search engines never follow it to a 404.
const alternateOf = cache(async (locale: Locale, slug: string | null) => {
  if (!slug) return null;
  const other: Locale = locale === 'en' ? 'ar' : 'en';
  const post = await loadPost(other, slug);
  return post ? { locale: other, href: blogPath(other, post.slug) } : null;
});

export async function generateMetadata({ params }: PageProps<'/[lang]/blog/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params;
  const resolved = await resolve(lang, slug);
  if (!resolved) return {};
  const { post, locale } = resolved;
  const url = blogPath(locale, post.slug);
  const [alternate, site] = await Promise.all([alternateOf(locale, post.alternate_slug), loadSite()]);
  const title = post.seo.meta_title ?? post.title;
  const description = post.seo.meta_description ?? post.excerpt;
  const image = socialImage(post);
  const imageAlt = post.seo.og_image ? title : post.cover_image ? post.cover_alt || title : title;
  return {
    title,
    description,
    keywords: post.seo.keywords.length > 0 ? post.seo.keywords : post.tags,
    authors: [{ name: post.author.name }],
    alternates: {
      canonical: post.seo.canonical_url ?? url,
      languages: alternate
        ? { [locale]: url, [alternate.locale]: alternate.href, 'x-default': locale === 'en' ? url : alternate.href }
        : undefined,
      types: { 'application/rss+xml': [{ url: `${blogPath(locale)}/rss.xml`, title: brandName }] },
    },
    robots: post.seo.noindex || !site.indexing
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: {
      type: 'article',
      siteName: brandName,
      locale: locale === 'ar' ? 'ar_AE' : 'en_IN',
      alternateLocale: alternate ? [alternate.locale === 'ar' ? 'ar_AE' : 'en_IN'] : undefined,
      url,
      title,
      description,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [post.author.name],
      section: post.tags[0],
      tags: post.tags,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image, alt: imageAlt }] },
  };
}

export default async function BlogPostPage({ params }: PageProps<'/[lang]/blog/[slug]'>) {
  const { lang, slug } = await params;
  const resolved = await resolve(lang, slug);
  if (!resolved) {
    // The language switch keeps the slug, but translations have their own. Send the reader to the matching one.
    if (isLocale(lang)) {
      const source = await loadPost(lang === 'en' ? 'ar' : 'en', slug);
      if (source?.alternate_slug) redirect(blogPath(lang, source.alternate_slug));
      if (source) redirect(blogPath(lang));
    }
    notFound();
  }
  const { post, locale } = resolved;
  const [dict, all, catalog] = await Promise.all([getDictionary(locale), loadPosts(locale), loadCatalog()]);
  const labels = dict.blog;
  const toc = outline(post.body);
  const destinations = post.country_codes.flatMap((code) => {
    const country = catalog.countries.find((item) => item.code === code);
    return country ? [summarizeCountry(country, locale)] : [];
  });
  // Related: most shared tags first, then newest.
  const related = all
    .filter((item) => item.slug !== post.slug)
    .map((item) => ({ item, score: item.tags.filter((tag) => post.tags.includes(tag)).length }))
    .sort((a, b) => b.score - a.score || b.item.published_at.localeCompare(a.item.published_at))
    .slice(0, 3)
    .map(({ item }) => item);
  const updated = post.updated_at.slice(0, 10) > post.published_at.slice(0, 10);
  const crumbs = [
    { name: labels.home, href: path(locale) },
    { name: labels.title, href: blogPath(locale) },
    { name: post.title, href: blogPath(locale, post.slug) },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([postLd(post), breadcrumbLd(crumbs)]) }} />
      <Container className="flex flex-col gap-16 pb-16 pt-8 md:gap-24 md:pt-12">
        <article className="flex flex-col gap-10 md:gap-14">
          <header className="flex max-w-4xl flex-col gap-6">
            <nav aria-label={labels.breadcrumb}>
              <ol className={cn(type.caption, 'flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-tertiary')}>
                {crumbs.slice(0, -1).map((crumb) => (
                  <li key={crumb.href} className="flex items-center gap-2">
                    <Link href={crumb.href} className={cn('rounded-chip transition-colors hover:text-fg', focusRing)}>
                      {crumb.name}
                    </Link>
                    <span aria-hidden className="rtl:-scale-x-100">
                      /
                    </span>
                  </li>
                ))}
                <li aria-current="page" className="max-w-[28ch] truncate text-fg-secondary">
                  {post.title}
                </li>
              </ol>
            </nav>
            {post.tags[0] ? <span className={cn(type.labelSm, 'text-accent')}>{post.tags[0]}</span> : null}
            <h1
              className={cn(
                type.displayXl,
                'text-balance normal-case md:text-[56px] md:leading-[60px] md:tracking-[-0.025em] md:rtl:text-[48px] md:rtl:leading-[68px] md:rtl:tracking-normal',
              )}
            >
              {post.title}
            </h1>
            <p className={cn(type.body, 'max-w-2xl text-fg-secondary md:text-[20px] md:leading-[31px]')}>{post.excerpt}</p>
            <div className="flex items-center gap-3 border-t border-line pt-6">
              <span aria-hidden className={cn(type.calloutStrong, 'flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-accent-tint text-accent')}>
                {post.author.name.replace(/^the\s+/i, '').charAt(0).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className={cn(type.calloutStrong, 'text-fg')}>{post.author.name}</span>
                <span className={cn(type.caption, 'flex flex-wrap gap-x-2 text-fg-tertiary')}>
                  <time dateTime={post.published_at}>{formatDate(post.published_at, locale)}</time>
                  {updated ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{format(labels.updated, { date: formatDate(post.updated_at, locale) })}</span>
                    </>
                  ) : null}
                  <span aria-hidden>·</span>
                  <span>{format(labels.minRead, { count: post.reading_minutes })}</span>
                </span>
              </div>
            </div>
          </header>

          <PostCover post={post} priority ratio="aspect-[16/9] md:aspect-[21/9]" />

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-20">
            <div className="flex min-w-0 max-w-[70ch] flex-col gap-10">
              {toc.length > 2 ? (
                <details className="group rounded-card border border-line bg-surface-1 lg:hidden">
                  <summary className={cn(type.calloutStrong, 'flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden')}>
                    {labels.onThisPage}
                    <span aria-hidden className="text-fg-tertiary transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <Toc items={toc} className="px-2 pb-3" />
                </details>
              ) : null}
              <Markdown source={post.body} />
              {post.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2 border-t border-line pt-8">
                  {post.tags.map((tag) => (
                    <li key={tag} className={cn(type.caption, 'rounded-pill border border-line px-3 py-1 text-fg-secondary')}>
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
              {toc.length > 0 ? (
                <nav aria-label={labels.onThisPage} className="hidden flex-col gap-3 lg:flex">
                  <p className={cn(type.labelSm, 'text-fg-tertiary')}>{labels.onThisPage}</p>
                  <Toc items={toc} />
                </nav>
              ) : null}
              {destinations.length > 0 ? (
                <section aria-labelledby="trip-plans" className="flex flex-col gap-3 rounded-card-lg border border-line bg-surface-1 p-4">
                  <div className="flex flex-col gap-1 px-1 pt-1">
                    <h2 id="trip-plans" className={type.title}>
                      {labels.plansFor}
                    </h2>
                    <p className={cn(type.caption, 'text-fg-tertiary')}>{labels.plansBody}</p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {destinations.slice(0, 5).map((item) => (
                      <li key={item.slug}>
                        <Link href={path(locale, `/destinations/${item.slug}`)} className={cn(cardLink, 'group flex items-center gap-3 bg-surface-2 px-3 py-2.5')}>
                          <Flag code={item.codes[0] ?? ''} size="md" />
                          <span className={cn(type.calloutStrong, 'min-w-0 flex-1 truncate')}>{item.name}</span>
                          <span className={cn(type.caption, 'shrink-0 text-fg-secondary')}>
                            <LocalFrom slug={item.slug} isRegion={false} fallback={item.from} template={dict.destination.from} />
                          </span>
                          <Arrow />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={path(locale, '/destinations')} className={cn(type.caption, 'px-1 pb-1 text-fg-secondary underline-offset-4 hover:text-fg hover:underline')}>
                    {labels.viewPlans}
                  </Link>
                </section>
              ) : null}
            </aside>
          </div>
        </article>

        {related.length > 0 ? (
          <section aria-labelledby="keep-reading" className="flex flex-col gap-8 border-t border-line pt-12">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="keep-reading" className={type.displayMd}>
                {labels.more}
              </h2>
              <Link href={blogPath(locale)} className={cn(type.calloutStrong, 'rounded-chip text-fg-secondary hover:text-fg', focusRing)}>
                {labels.allPosts}
              </Link>
            </div>
            <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <PostCard post={item} locale={locale} labels={labels} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <BlogCta locale={locale} labels={labels} />
      </Container>
    </>
  );
}

function Toc({ items, className }: { items: { id: string; text: string }[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col border-s border-line', className)}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={cn(
              type.callout,
              '-ms-px block border-s border-transparent py-1.5 ps-4 text-fg-secondary transition-colors hover:border-accent hover:text-fg',
              focusRing,
            )}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
