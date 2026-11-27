import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AdminEnv } from '../auth/staff';
import { createStorage } from '../integrations/storage';
import { HttpError } from '../lib/errors';
import * as blog from '../services/blog.service';
import * as seo from '../services/seo.service';
import * as uploads from '../services/uploads.service';
import { blank, blankDeep, blogCreate, blogPatch, optionalDate, parse, seoPageBody, seoSiteBody, seoTarget, uploadsQuery } from '../validators/admin.validators';

type C = Context<AdminEnv>;

const body = (c: C) => c.req.json().catch(() => null);
const id = (c: C) => c.req.param('id') ?? '';
const storageDeps = (c: C) => ({ db: c.var.deps.db, storage: c.var.deps.storage ?? createStorage(c.var.deps.env, c.var.logger) });

/* Blog. */

export const listPosts = async (c: C) => c.json(await blog.listPosts(c.var.deps.db));

export async function createPost(c: C) {
  return c.json(await blog.createPost(c.var.deps.db, c.var.user.id, c.var.role, parse(blogCreate, blank(await body(c)))), 201);
}

export const getPost = async (c: C) => c.json(await blog.getPost(c.var.deps.db, id(c)));

export async function updatePost(c: C) {
  return c.json(await blog.updatePost(c.var.deps.db, c.var.user.id, c.var.role, id(c), parse(blogPatch, blank(await body(c)))));
}

export async function deletePost(c: C) {
  await blog.deletePost(c.var.deps.db, c.var.user.id, id(c));
  return c.body(null, 204);
}

/* SEO. */

export async function getSeo(c: C) {
  const [site, pages] = await Promise.all([seo.siteSettings(c.var.deps.db), seo.listSeoPages(c.var.deps.db)]);
  return c.json({ site, pages });
}

export async function saveSite(c: C) {
  return c.json(await seo.saveSiteSettings(c.var.deps.db, c.var.user.id, parse(seoSiteBody, blankDeep(await body(c)))));
}

export async function savePage(c: C) {
  const target = seoTarget({ key: c.req.param('key'), locale: c.req.param('locale') });
  const input = parse(seoPageBody, blankDeep(await body(c)));
  return c.json(await seo.saveSeoPage(c.var.deps.db, c.var.user.id, target.key, target.locale, input));
}

export async function resetPage(c: C) {
  const target = seoTarget({ key: c.req.param('key'), locale: c.req.param('locale') });
  await seo.resetSeoPage(c.var.deps.db, c.var.user.id, target.key, target.locale);
  return c.body(null, 204);
}

/* Uploads. */

/** Caps the request size a little over the image limit, for the multipart wrapping. */
export const uploadSizeLimit: MiddlewareHandler<AdminEnv> = (c, next) =>
  bodyLimit({
    maxSize: c.var.deps.env.UPLOAD_MAX_MB * 1024 * 1024 + 64 * 1024,
    onError: () => {
      throw new HttpError(413, 'too_large', `Images can be up to ${c.var.deps.env.UPLOAD_MAX_MB} MB`);
    },
  })(c, next);

export async function createUpload(c: C) {
  const form = await c.req.parseBody().catch(() => null);
  const file = form?.file;
  if (!(file instanceof File)) throw new HttpError(400, 'invalid_request', 'Send the image as a "file" form field');
  const alt = typeof form?.alt === 'string' ? form.alt.trim() : '';
  const saved = await uploads.saveUpload(
    storageDeps(c),
    c.var.user.id,
    { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name, alt },
    c.var.deps.env.UPLOAD_MAX_MB * 1024 * 1024,
  );
  return c.json(saved, 201);
}

export async function listUploads(c: C) {
  const query = parse(uploadsQuery, c.req.query());
  return c.json(await uploads.listUploads(c.var.deps.db, { limit: query.limit, before: optionalDate(query.before) }));
}

export async function deleteUpload(c: C) {
  await uploads.deleteUpload(storageDeps(c), c.var.user.id, id(c));
  return c.body(null, 204);
}
