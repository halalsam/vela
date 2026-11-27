import { desc, eq, lt } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { upload } from '../../db/schema';
import { HttpError, notFound } from '../../lib/errors';
import { audit } from '../admin/admin';
import { sniffImage } from './image';
import type { Storage } from './storage';

type Row = typeof upload.$inferSelect;

export type UploadOut = {
  id: string;
  url: string;
  driver: string;
  content_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  original_name: string;
  alt: string;
  created_at: string;
};

const out = (row: Row): UploadOut => ({
  id: row.id,
  url: row.url,
  driver: row.driver,
  content_type: row.contentType,
  bytes: row.bytes,
  width: row.width,
  height: row.height,
  original_name: row.originalName,
  alt: row.alt,
  created_at: row.createdAt.toISOString(),
});

/** Disk keys look like images/2026/11/<uuid>.webp. The public file route only serves keys of this shape. */
export const UPLOAD_KEY_PATTERN = /^images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|avif)$/;

export async function saveUpload(
  deps: { db: Database; storage: Storage },
  actorId: string,
  file: { bytes: Uint8Array; name: string; alt: string },
  maxBytes: number,
) {
  if (file.bytes.byteLength === 0) throw new HttpError(400, 'empty_file', 'The file is empty');
  if (file.bytes.byteLength > maxBytes) throw new HttpError(413, 'too_large', `Images can be up to ${Math.round(maxBytes / 1024 / 1024)} MB`);
  const image = sniffImage(file.bytes);
  if (!image) throw new HttpError(415, 'unsupported_type', 'Upload a JPG, PNG, WebP, GIF or AVIF image');
  const now = new Date();
  const key = `images/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${image.ext}`;
  const stored = await deps.storage.put(key, file.bytes, image.mime);
  const [row] = await deps.db
    .insert(upload)
    .values({
      key,
      url: stored.url,
      driver: stored.driver,
      contentType: image.mime,
      bytes: file.bytes.byteLength,
      width: image.width,
      height: image.height,
      originalName: file.name.slice(0, 200),
      alt: file.alt.slice(0, 300),
      createdBy: actorId,
    })
    .returning();
  await audit(deps.db, actorId, 'upload.create', `upload:${row!.id}`, { driver: stored.driver, bytes: file.bytes.byteLength });
  return out(row!);
}

export async function listUploads(db: Database, options: { limit: number; before?: Date }) {
  const rows = await db
    .select()
    .from(upload)
    .where(options.before ? lt(upload.createdAt, options.before) : undefined)
    .orderBy(desc(upload.createdAt))
    .limit(options.limit);
  return rows.map(out);
}

export async function deleteUpload(deps: { db: Database; storage: Storage }, actorId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Upload');
  const [row] = await deps.db.select().from(upload).where(eq(upload.id, id));
  if (!row) throw notFound('Upload');
  await deps.storage.remove(row.key, row.driver === 's3' ? 's3' : 'disk');
  await deps.db.delete(upload).where(eq(upload.id, id));
  await audit(deps.db, actorId, 'upload.delete', `upload:${id}`, { url: row.url });
}
