import type { UploadRow as Row } from '../models/content.model';

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

export const uploadView = (row: Row): UploadOut => ({
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
