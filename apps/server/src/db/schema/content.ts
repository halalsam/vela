import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { blogStatus, contentLocale } from './enums';

// Blog posts for the website. One row per language: an English post and its Arabic version are two rows, linked by
// alternateSlug so the site can emit hreflang. A post is public when it is published and publishedAt has passed,
// so a future publishedAt schedules it.
export const blogPost = pgTable(
  'blog_post',
  {
    id: uuid().primaryKey().defaultRandom(),
    locale: contentLocale().notNull(),
    slug: text().notNull(),
    title: text().notNull(),
    excerpt: text().notNull(),
    body: text().notNull(),
    coverImage: text(),
    coverAlt: text().notNull().default(''),
    authorName: text().notNull(),
    authorRole: text(),
    tags: text().array().notNull().default([]),
    countryCodes: text().array().notNull().default([]),
    status: blogStatus().notNull().default('draft'),
    publishedAt: timestamp({ withTimezone: true }),
    alternateSlug: text(),
    // SEO overrides. Null falls back to the title, excerpt and cover.
    metaTitle: text(),
    metaDescription: text(),
    canonicalUrl: text(),
    ogImage: text(),
    keywords: text().array().notNull().default([]),
    noindex: boolean().notNull().default(false),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('blog_post_locale_slug_idx').on(table.locale, table.slug),
    index('blog_post_feed_idx').on(table.locale, table.status, table.publishedAt),
  ],
);
