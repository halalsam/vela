import { and, asc, desc, eq, lt, lte } from 'drizzle-orm';
import type { Database } from '../db/client';
import { blogPost, seoPage, seoSetting, upload } from '../db/schema';

export type BlogPostRow = typeof blogPost.$inferSelect;
export type NewBlogPost = typeof blogPost.$inferInsert;
export type SeoPageRow = typeof seoPage.$inferSelect;
export type UploadRow = typeof upload.$inferSelect;
type Locale = BlogPostRow['locale'];

/* Blog posts. Public reads only see published posts whose publish time has passed. */

const live = (locale: Locale, now: Date) => and(eq(blogPost.locale, locale), eq(blogPost.status, 'published'), lte(blogPost.publishedAt, now));

export async function livePosts(db: Database, locale: Locale, limit: number): Promise<BlogPostRow[]> {
  return db.select().from(blogPost).where(live(locale, new Date())).orderBy(desc(blogPost.publishedAt)).limit(limit);
}

export async function livePost(db: Database, locale: Locale, slug: string): Promise<BlogPostRow | null> {
  const [row] = await db
    .select()
    .from(blogPost)
    .where(and(live(locale, new Date()), eq(blogPost.slug, slug)));
  return row ?? null;
}

export async function allPosts(db: Database): Promise<BlogPostRow[]> {
  return db.select().from(blogPost).orderBy(desc(blogPost.updatedAt));
}

export async function findPost(db: Database, id: string): Promise<BlogPostRow | null> {
  const [row] = await db.select().from(blogPost).where(eq(blogPost.id, id));
  return row ?? null;
}

export async function findPostIdBySlug(db: Database, locale: Locale, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: blogPost.id })
    .from(blogPost)
    .where(and(eq(blogPost.locale, locale), eq(blogPost.slug, slug)));
  return row?.id ?? null;
}

export async function anyPostExists(db: Database): Promise<boolean> {
  const [row] = await db.select({ id: blogPost.id }).from(blogPost).limit(1);
  return Boolean(row);
}

/** Inserts the post, or returns null when the slug is taken in that language. */
export async function insertPost(db: Database, values: NewBlogPost): Promise<BlogPostRow | null> {
  const [row] = await db.insert(blogPost).values(values).onConflictDoNothing().returning();
  return row ?? null;
}

export async function updatePost(db: Database, id: string, values: Partial<NewBlogPost>): Promise<BlogPostRow | null> {
  const [row] = await db
    .update(blogPost)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(blogPost.id, id))
    .returning();
  return row ?? null;
}

export async function deletePost(db: Database, id: string): Promise<void> {
  await db.delete(blogPost).where(eq(blogPost.id, id));
}

/* SEO page overrides and site settings. */

export async function seoPagesFor(db: Database, locale: Locale): Promise<SeoPageRow[]> {
  return db.select().from(seoPage).where(eq(seoPage.locale, locale));
}

export async function allSeoPages(db: Database): Promise<SeoPageRow[]> {
  return db.select().from(seoPage).orderBy(asc(seoPage.key), asc(seoPage.locale));
}

export async function upsertSeoPage(db: Database, key: string, locale: Locale, values: Omit<typeof seoPage.$inferInsert, 'key' | 'locale'>): Promise<SeoPageRow> {
  const [row] = await db
    .insert(seoPage)
    .values({ key, locale, ...values })
    .onConflictDoUpdate({ target: [seoPage.key, seoPage.locale], set: values })
    .returning();
  return row!;
}

export async function deleteSeoPage(db: Database, key: string, locale: Locale): Promise<void> {
  await db.delete(seoPage).where(and(eq(seoPage.key, key), eq(seoPage.locale, locale)));
}

export async function findSetting(db: Database, id: string) {
  const [row] = await db.select().from(seoSetting).where(eq(seoSetting.id, id));
  return row ?? null;
}

export async function saveSetting(db: Database, id: string, value: unknown, actorId: string): Promise<void> {
  await db
    .insert(seoSetting)
    .values({ id, value, updatedBy: actorId })
    .onConflictDoUpdate({ target: seoSetting.id, set: { value, updatedBy: actorId, updatedAt: new Date() } });
}

/* Uploaded images. */

export async function insertUpload(db: Database, values: typeof upload.$inferInsert): Promise<UploadRow> {
  const [row] = await db.insert(upload).values(values).returning();
  return row!;
}

export async function listUploads(db: Database, options: { limit: number; before?: Date }): Promise<UploadRow[]> {
  return db
    .select()
    .from(upload)
    .where(options.before ? lt(upload.createdAt, options.before) : undefined)
    .orderBy(desc(upload.createdAt))
    .limit(options.limit);
}

export async function findUpload(db: Database, id: string): Promise<UploadRow | null> {
  const [row] = await db.select().from(upload).where(eq(upload.id, id));
  return row ?? null;
}

export async function deleteUpload(db: Database, id: string): Promise<void> {
  await db.delete(upload).where(eq(upload.id, id));
}
