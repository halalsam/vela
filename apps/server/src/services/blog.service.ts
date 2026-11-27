import type { BlogLocale } from '@vela/api';
import type { Database } from '../db/client';
import { HttpError, notFound } from '../lib/errors';
import { audit } from '../models/audit.model';
import * as content from '../models/content.model';
import { adminPostOut, postOut, summaryOut } from '../views/blog.view';
import type { StaffRole } from './admin.service';

type Row = content.BlogPostRow;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_LIST_LIMIT = 200;

export async function listPublishedPosts(db: Database, locale: BlogLocale) {
  return (await content.livePosts(db, locale, PUBLIC_LIST_LIMIT)).map(summaryOut);
}

export async function publishedPost(db: Database, locale: BlogLocale, slug: string) {
  const row = await content.livePost(db, locale, slug);
  if (!row) throw notFound('Post');
  return postOut(row);
}

// Staff side.

export type BlogInput = {
  locale: BlogLocale;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  cover_alt: string;
  author_name: string;
  author_role: string | null;
  tags: string[];
  country_codes: string[];
  status: 'draft' | 'published';
  published_at: string | null;
  alternate_slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image: string | null;
  keywords: string[];
  noindex: boolean;
};

function values(input: Partial<BlogInput>): Partial<content.NewBlogPost> {
  const set: Partial<content.NewBlogPost> = {};
  if (input.locale !== undefined) set.locale = input.locale;
  if (input.slug !== undefined) set.slug = input.slug;
  if (input.title !== undefined) set.title = input.title;
  if (input.excerpt !== undefined) set.excerpt = input.excerpt;
  if (input.body !== undefined) set.body = input.body;
  if (input.cover_image !== undefined) set.coverImage = input.cover_image;
  if (input.cover_alt !== undefined) set.coverAlt = input.cover_alt;
  if (input.author_name !== undefined) set.authorName = input.author_name;
  if (input.author_role !== undefined) set.authorRole = input.author_role;
  if (input.tags !== undefined) set.tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (input.country_codes !== undefined) set.countryCodes = [...new Set(input.country_codes.map((code) => code.toUpperCase()))];
  if (input.status !== undefined) set.status = input.status;
  if (input.published_at !== undefined) set.publishedAt = input.published_at ? new Date(input.published_at) : null;
  if (input.alternate_slug !== undefined) set.alternateSlug = input.alternate_slug;
  if (input.meta_title !== undefined) set.metaTitle = input.meta_title;
  if (input.meta_description !== undefined) set.metaDescription = input.meta_description;
  if (input.canonical_url !== undefined) set.canonicalUrl = input.canonical_url;
  if (input.og_image !== undefined) set.ogImage = input.og_image;
  if (input.keywords !== undefined) set.keywords = [...new Set(input.keywords.map((word) => word.trim().toLowerCase()).filter(Boolean))];
  if (input.noindex !== undefined) set.noindex = input.noindex;
  return set;
}

// Support staff write drafts; publishing, unpublishing and deleting are for admins.
function guardPublish(role: StaffRole, next: 'draft' | 'published' | undefined, current?: Row) {
  if (role === 'admin') return;
  if (next === 'published' || current?.status === 'published') throw new HttpError(403, 'forbidden', 'Only admins can publish or edit published posts');
}

export async function listPosts(db: Database) {
  return (await content.allPosts(db)).map(adminPostOut);
}

async function find(db: Database, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Post');
  const row = await content.findPost(db, id);
  if (!row) throw notFound('Post');
  return row;
}

export async function getPost(db: Database, id: string) {
  return adminPostOut(await find(db, id));
}

export async function createPost(db: Database, actorId: string, role: StaffRole, input: BlogInput) {
  guardPublish(role, input.status);
  const set = values(input);
  // Publishing without a date means now.
  if (input.status === 'published' && !set.publishedAt) set.publishedAt = new Date();
  const created = await content.insertPost(db, { ...(set as content.NewBlogPost), createdBy: actorId });
  if (!created) throw new HttpError(409, 'slug_taken', 'Another post in this language already uses that slug');
  await audit(db, actorId, 'blog.create', `blog:${created.id}`, { slug: created.slug, locale: created.locale, status: created.status });
  return adminPostOut(created);
}

export async function updatePost(db: Database, actorId: string, role: StaffRole, id: string, input: Partial<BlogInput>) {
  const current = await find(db, id);
  guardPublish(role, input.status, current);
  const set = values(input);
  const status = input.status ?? current.status;
  const publishedAt = input.published_at === undefined ? current.publishedAt : (set.publishedAt ?? null);
  if (status === 'published' && !publishedAt) set.publishedAt = new Date();
  const locale = input.locale ?? current.locale;
  const slug = input.slug ?? current.slug;
  if (locale !== current.locale || slug !== current.slug) {
    const clash = await content.findPostIdBySlug(db, locale, slug);
    if (clash && clash !== id) throw new HttpError(409, 'slug_taken', 'Another post in this language already uses that slug');
  }
  const updated = await content.updatePost(db, id, set);
  if (!updated) throw notFound('Post');
  await audit(db, actorId, 'blog.update', `blog:${id}`, { fields: Object.keys(input), status: updated.status });
  return adminPostOut(updated);
}

export async function deletePost(db: Database, actorId: string, id: string) {
  const current = await find(db, id);
  await content.deletePost(db, id);
  await audit(db, actorId, 'blog.delete', `blog:${id}`, { slug: current.slug, locale: current.locale });
}
