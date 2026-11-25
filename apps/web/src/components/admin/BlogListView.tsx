'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ButtonLink, Card, Pill, focusRing } from '@/components/ui';
import { adminFetch, blogState, when, type AdminBlogPost, type BlogState } from '@/lib/adminApi';
import { seoChecks, seoScore } from '@/lib/blogSeo';
import { cn, type } from '@/lib/type';

const tone: Record<BlogState, 'neutral' | 'accent' | 'success'> = { draft: 'neutral', scheduled: 'accent', published: 'success' };
const FILTERS = ['all', 'published', 'scheduled', 'draft'] as const;

export function scoreTone(score: number) {
  return score >= 80 ? 'text-success' : score >= 55 ? 'text-warning' : 'text-danger';
}

export function postScore(post: AdminBlogPost) {
  return seoScore(
    seoChecks({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      body: post.body,
      cover_image: post.cover_image ?? '',
      cover_alt: post.cover_alt,
      meta_title: post.seo.meta_title ?? '',
      meta_description: post.seo.meta_description ?? '',
      keywords: post.seo.keywords.join(', '),
      noindex: post.seo.noindex,
    }),
  );
}

export function BlogListView() {
  const [posts, setPosts] = useState<AdminBlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminBlogPost[]>('/v1/admin/blog').then(
      (data) => !cancelled && setPosts(data),
      (caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : 'Couldn’t load posts'),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (posts ?? [])
      .filter((post) => filter === 'all' || blogState(post) === filter)
      .filter((post) => !needle || post.title.toLowerCase().includes(needle) || post.slug.includes(needle) || post.tags.some((tag) => tag.toLowerCase().includes(needle)));
  }, [posts, filter, query]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={type.displayLg}>blog</h1>
          <p className={cn(type.callout, 'text-fg-secondary')}>Guides on the website, in English and Arabic.</p>
        </div>
        <ButtonLink href="/admin/blog/new">New post</ButtonLink>
      </div>
      {error ? (
        <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => {
            const count = item === 'all' ? (posts?.length ?? 0) : (posts ?? []).filter((post) => blogState(post) === item).length;
            return (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={filter === item}
                onClick={() => setFilter(item)}
                className={cn(
                  type.calloutStrong,
                  'inline-flex h-9 items-center gap-1.5 rounded-pill border px-3.5 capitalize transition-colors',
                  filter === item ? 'border-fg bg-fg text-fg-inverse' : 'border-line bg-surface-1 text-fg-secondary hover:text-fg',
                  focusRing,
                )}
              >
                {item}
                <span className={cn('tabular-nums', filter === item ? 'text-fg-inverse/55' : 'text-fg-quaternary')}>{count}</span>
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, slug or tag"
          aria-label="Search posts"
          className={cn(type.callout, 'h-9 w-full rounded-pill border border-line bg-surface-1 px-4 text-fg outline-none placeholder:text-fg-tertiary focus:border-accent/60 sm:ms-auto sm:w-64')}
        />
      </div>
      {posts === null ? (
        <div className="h-60 animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" aria-busy />
      ) : shown.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-section">
          <p className={type.title}>{posts.length === 0 ? 'No posts yet' : 'Nothing matches'}</p>
          <p className={cn(type.callout, 'text-fg-secondary')}>
            {posts.length === 0 ? 'Write the first guide. It stays a draft until you publish it.' : 'Try another status or search.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className={cn(type.labelSm, 'text-fg-tertiary')}>
                {['Post', 'Language', 'Status', 'SEO', 'Updated'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-start font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((post) => {
                const state = blogState(post);
                const score = postScore(post);
                return (
                  <tr key={post.id} className="border-t border-line transition-colors hover:bg-surface-2/50">
                    <td className="max-w-[420px] px-4 py-3">
                      <Link href={`/admin/blog/${post.id}`} className={cn(type.calloutStrong, 'block truncate rounded-chip hover:text-accent', focusRing)}>
                        {post.title || 'Untitled'}
                      </Link>
                      <span className={cn(type.caption, 'block truncate text-fg-tertiary')} dir="ltr">
                        /{post.locale}/blog/{post.slug}
                      </span>
                    </td>
                    <td className={cn(type.callout, 'px-4 py-3 uppercase text-fg-secondary')}>{post.locale}</td>
                    <td className="px-4 py-3">
                      <Pill tone={tone[state]}>{state}</Pill>
                      {state === 'scheduled' ? <span className={cn(type.caption, 'ms-2 text-fg-tertiary')}>{when(post.published_at)}</span> : null}
                    </td>
                    <td className={cn(type.calloutStrong, 'px-4 py-3 tabular-nums', scoreTone(score))}>{score}</td>
                    <td className={cn(type.caption, 'px-4 py-3 text-fg-tertiary')}>{when(post.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
