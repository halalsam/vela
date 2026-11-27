import { Hono } from 'hono';
import { contentTypeForExt } from '../modules/uploads/image';
import { createStorage } from '../modules/uploads/storage';
import { UPLOAD_KEY_PATTERN } from '../modules/uploads/uploads';
import type { AppEnv } from '../types';

// Serves images saved on this server's disk (the fallback when S3 isn't used). Files never change once written, so
// they cache for a year. Only generated image keys are served, with headers that stop browsers running anything.
export const uploadRoutes = new Hono<AppEnv>().get('/v1/uploads/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice('/v1/uploads/'.length));
  if (!UPLOAD_KEY_PATTERN.test(key)) return c.json({ error: { code: 'not_found', message: 'File not found' } }, 404);
  const storage = c.var.deps.storage ?? createStorage(c.var.deps.env, c.var.logger);
  const bytes = await storage.readDisk(key);
  if (!bytes) return c.json({ error: { code: 'not_found', message: 'File not found' } }, 404);
  const ext = key.slice(key.lastIndexOf('.') + 1);
  return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
    'Content-Type': contentTypeForExt[ext] ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    // The website and app load these from another origin.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
});
