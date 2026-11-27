import type { Database } from '../db/client';
import type { Storage } from '../integrations/storage';
import { HttpError, notFound } from '../lib/errors';
import { sniffImage } from '../lib/image';
import { audit } from '../models/audit.model';
import * as content from '../models/content.model';
import { uploadView } from '../views/upload.view';

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
  const row = await content.insertUpload(deps.db, {
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
  });
  await audit(deps.db, actorId, 'upload.create', `upload:${row.id}`, { driver: stored.driver, bytes: file.bytes.byteLength });
  return uploadView(row);
}

export async function listUploads(db: Database, options: { limit: number; before?: Date }) {
  return (await content.listUploads(db, options)).map(uploadView);
}

export async function deleteUpload(deps: { db: Database; storage: Storage }, actorId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Upload');
  const row = await content.findUpload(deps.db, id);
  if (!row) throw notFound('Upload');
  await deps.storage.remove(row.key, row.driver === 's3' ? 's3' : 'disk');
  await content.deleteUpload(deps.db, id);
  await audit(deps.db, actorId, 'upload.delete', `upload:${id}`, { url: row.url });
}
