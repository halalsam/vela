import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { brandName } from '@vela/brand';
import { BlogCta } from '@/components/sections/blog/BlogCta';
import { FeaturedPost, PostCard } from '@/components/sections/blog/PostCards';
import { ButtonLink, Container } from '@/components/ui';
import { blogLd, blogPath, breadcrumbLd, ldJson, loadPosts } from '@/lib/blog';
import { isLocale, path } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { extraLd, pageMetadata, resolvePageSeo } from '@/lib/seo';
import { getDictionary } from '../dictionaries';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[lang]/blog'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [dict, posts, base] = await Promise.all([getDictionary(lang), loadPosts(lang), pageMetadata({ key: 'blog', locale: lang, path: '/blog' })]);
  const url = blogPath(lang);
  return {
    ...base,
    alternates: {
      ...base.alternates,
      types: { 'application/rss+xml': [{ url: `${url}/rss.xml`, title: `${brandName} · ${dict.blog.title}` }] },
    },
    // An empty blog is a thin page: keep it out of the index until the first post is live.
    robots: posts.length === 0 ? { index: false, follow: true } : base.robots,
  };
}

export default async function BlogPage({ params }: PageProps<'/[lang]/blog'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dict, posts, seo] = await Promise.all([getDictionary(lang), loadPosts(lang), resolvePageSeo({ key: 'blog', locale: lang, path: '/blog' })]);
  const labels = dict.blog;
  const [featured, ...rest] = posts;
  const structured = [
    blogLd(lang, seo.title, seo.description, posts),
    breadcrumbLd([
      { name: labels.home, href: path(lang) },
      { name: labels.title, href: blogPath(lang) },
    ]),
    ...extraLd(seo),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(structured) }} />
      <Container className="flex flex-col gap-14 pb-16 pt-12 md:gap-20 md:pt-16">
        <header className="flex flex-col gap-5 border-b border-line pb-10 md:flex-row md:items-end md:justify-between md:gap-12 md:pb-14">
          <div className="flex max-w-2xl flex-col gap-4">
            <h1 className={cn(type.displayXl, 'md:text-[72px] md:leading-[72px] md:tracking-[-0.03em] md:rtl:text-[60px] md:rtl:leading-[84px] md:rtl:tracking-normal')}>
              {labels.title}
            </h1>
            <p className={cn(type.body, 'max-w-xl text-fg-secondary md:text-[18px] md:leading-[28px]')}>{labels.intro}</p>
          </div>
          <a
            href={`${blogPath(lang)}/rss.xml`}
            className={cn(type.callout, 'inline-flex items-center gap-2 self-start text-fg-tertiary transition-colors hover:text-fg md:self-auto')}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
              <circle cx="5" cy="19" r="1" fill="currentColor" />
            </svg>
            {labels.rss}
          </a>
        </header>

        {featured ? (
          <FeaturedPost post={featured} locale={lang} labels={labels} />
        ) : (
          <div className="flex max-w-lg flex-col items-start gap-4 py-6">
            <h2 className={type.displayMd}>{labels.emptyTitle}</h2>
            <p className={cn(type.body, 'text-fg-secondary')}>{labels.emptyBody}</p>
            <ButtonLink href={path(lang, '/help')} variant="secondary">
              {labels.emptyAction}
            </ButtonLink>
          </div>
        )}

        {rest.length > 0 ? (
          <section aria-labelledby="all-posts" className="flex flex-col gap-8">
            <h2 id="all-posts" className={type.displayMd}>
              {labels.allPosts}
            </h2>
            <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <li key={post.slug}>
                  <PostCard post={post} locale={lang} labels={labels} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <BlogCta locale={lang} labels={labels} />
      </Container>
    </>
  );
}
