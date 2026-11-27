import type { Context } from 'hono';
import { createStorage } from '../integrations/storage';
import { contentTypeForExt } from '../lib/image';
import type * as routes from '../routes/content.routes';
import * as blog from '../services/blog.service';
import * as seo from '../services/seo.service';
import { UPLOAD_KEY_PATTERN } from '../services/uploads.service';
import type { AppEnv, Handler } from '../types';

export const listPosts: Handler<typeof routes.postsRoute> = async (c) =>
  c.json(await blog.listPublishedPosts(c.var.deps.db, c.req.valid('query').locale), 200);

export const getPost: Handler<typeof routes.postRoute> = async (c) =>
  c.json(await blog.publishedPost(c.var.deps.db, c.req.valid('query').locale, c.req.valid('param').slug), 200);

export const seoBundle: Handler<typeof routes.seoRoute> = async (c) => c.json(await seo.seoBundle(c.var.deps.db, c.req.valid('query').locale), 200);

const fileNotFound = (c: Context<AppEnv>) => c.json({ error: { code: 'not_found', message: 'File not found' } }, 404);

// Serves images saved on this server's disk (the fallback when S3 isn't used). Files never change once written, so
// they cache for a year. Only generated image keys are served, with headers that stop browsers running anything.
export async function serveUpload(c: Context<AppEnv>) {
  const key = decodeURIComponent(c.req.path.slice('/v1/uploads/'.length));
  if (!UPLOAD_KEY_PATTERN.test(key)) return fileNotFound(c);
  const storage = c.var.deps.storage ?? createStorage(c.var.deps.env, c.var.logger);
  const bytes = await storage.readDisk(key);
  if (!bytes) return fileNotFound(c);
  const ext = key.slice(key.lastIndexOf('.') + 1);
  return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
    'Content-Type': contentTypeForExt[ext] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    // The website and app load these from another origin.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
}
