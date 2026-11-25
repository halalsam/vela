/* eslint-disable @next/next/no-img-element -- cover images can come from any https host set in the admin */
import Link from 'next/link';
import { CountryMap, FlagStack } from '@/components/esim';
import type { BlogPostSummary } from '@vela/api';
import { blogPath, formatDate } from '@/lib/blogFormat';
import { format, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';
import { Arrow } from '../destinations/cards';

/**
 * The post's cover image, or a drawn one when there isn't: the first destination's outline, its flags and a
 * champagne glow. Covers keep a fixed ratio so the grid never shifts while images load.
 */
export function PostCover({
  post,
  ratio = 'aspect-[16/10]',
  priority = false,
  className,
}: {
  post: Pick<BlogPostSummary, 'cover_image' | 'cover_alt' | 'country_codes'>;
  ratio?: string;
  priority?: boolean;
  className?: string;
}) {
  const code = post.country_codes[0];
  return (
    <div className={cn('relative overflow-hidden rounded-card-lg border border-line bg-surface-1', ratio, className)}>
      {post.cover_image ? (
        <img
          src={post.cover_image}
          alt={post.cover_alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow ease-vela motion-safe:group-hover:scale-[1.03]"
        />
      ) : (
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(200,178,133,0.16),transparent_55%)] rtl:bg-[radial-gradient(circle_at_20%_90%,rgba(200,178,133,0.16),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(circle_at_70%_60%,black,transparent_75%)]" />
          {code ? (
            <CountryMap
              code={code}
              opacity={0.85}
              className="absolute -bottom-[6%] end-[6%] h-[78%] w-[52%] transition-transform duration-slow ease-vela motion-safe:group-hover:-translate-y-1"
            />
          ) : (
            <img src="/geo/continents/asia.svg" alt="" className="absolute -bottom-[18%] -end-[8%] h-[95%] w-auto max-w-none opacity-[0.12]" />
          )}
          {post.country_codes.length > 0 ? (
            <span className="absolute start-5 top-5">
              <FlagStack codes={post.country_codes} size="md" max={4} />
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Meta({ post, locale, labels }: { post: BlogPostSummary; locale: Locale; labels: Dictionary['blog'] }) {
  return (
    <p className={cn(type.caption, 'flex flex-wrap items-center gap-x-2 text-fg-tertiary')}>
      {post.tags[0] ? <span className="text-accent">{post.tags[0]}</span> : null}
      {post.tags[0] ? <span aria-hidden>·</span> : null}
      <time dateTime={post.published_at}>{formatDate(post.published_at, locale)}</time>
      <span aria-hidden>·</span>
      <span>{format(labels.minRead, { count: post.reading_minutes })}</span>
    </p>
  );
}

/** The newest post, wide: cover on one side, title and excerpt on the other. */
export function FeaturedPost({ post, locale, labels }: { post: BlogPostSummary; locale: Locale; labels: Dictionary['blog'] }) {
  return (
    <article className="group relative grid gap-6 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-12">
      <PostCover post={post} priority ratio="aspect-[16/10]" />
      <div className="flex flex-col items-start gap-4">
        <span className={cn(type.labelSm, 'text-accent')}>{labels.latest}</span>
        <h2 className={cn(type.displayLg, 'normal-case md:text-[40px] md:leading-[46px] md:rtl:text-[36px] md:rtl:leading-[52px]')}>
          <Link href={blogPath(locale, post.slug)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </h2>
        <p className={cn(type.body, 'max-w-[52ch] text-fg-secondary md:text-[18px] md:leading-[28px]')}>{post.excerpt}</p>
        <Meta post={post} locale={locale} labels={labels} />
        <span className={cn(type.calloutStrong, 'mt-2 inline-flex items-center gap-3 text-fg')}>
          {labels.read}
          <Arrow />
        </span>
      </div>
      {/* Focus ring for the stretched link, drawn around the whole card. */}
      <span aria-hidden className="pointer-events-none absolute -inset-3 rounded-sheet ring-accent/70 group-has-[:focus-visible]:ring-2" />
    </article>
  );
}

export function PostCard({ post, locale, labels, headingLevel = 'h3' }: { post: BlogPostSummary; locale: Locale; labels: Dictionary['blog']; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex h-full flex-col gap-4">
      <PostCover post={post} />
      <div className="flex flex-1 flex-col gap-2.5">
        <Meta post={post} locale={locale} labels={labels} />
        <Heading className={cn(type.title, 'text-[20px] leading-[27px] text-fg transition-colors group-hover:text-accent rtl:text-[19px] rtl:leading-[30px]')}>
          <Link href={blogPath(locale, post.slug)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </Heading>
        <p className={cn(type.callout, 'line-clamp-3 text-fg-secondary')}>{post.excerpt}</p>
      </div>
      <span aria-hidden className="pointer-events-none absolute -inset-3 rounded-sheet ring-accent/70 group-has-[:focus-visible]:ring-2" />
    </article>
  );
}
