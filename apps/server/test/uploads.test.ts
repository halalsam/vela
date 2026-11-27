import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { profile, user } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { sniffImage } from '../src/modules/uploads/image';
import { createStorage } from '../src/modules/uploads/storage';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testKey } from './helpers';

// 1×1 PNG and a 3×2 GIF.
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 3, 0, 2, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 3, 0, 2, 0, 0, 0x3b]);

let dir: string;
let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;

const envWith = (extra: Record<string, string>) =>
  loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://test@localhost/test',
    ENCRYPTION_KEY: testKey,
    LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    API_PUBLIC_URL: 'https://api.example.com',
    UPLOAD_DIR: dir,
    UPLOAD_MAX_MB: '1',
    ...extra,
  });

async function setRole(phone: string, role: 'customer' | 'support' | 'admin') {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
  await db.update(profile).set({ role }).where(eq(profile.userId, row?.id ?? ''));
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vela-uploads-'));
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
});

afterAll(async () => {
  await close();
  await rm(dir, { recursive: true, force: true });
});

const form = (bytes: Uint8Array, name = 'photo.png', alt = '') => {
  const body = new FormData();
  body.set('file', new File([bytes as Uint8Array<ArrayBuffer>], name, { type: 'image/png' }));
  if (alt) body.set('alt', alt);
  return body;
};

describe('image sniffing', () => {
  it('reads type and size from the bytes', () => {
    expect(sniffImage(png)).toMatchObject({ mime: 'image/png', ext: 'png', width: 1, height: 1 });
    expect(sniffImage(gif)).toMatchObject({ mime: 'image/gif', width: 3, height: 2 });
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
  });
});

describe('uploads on disk', () => {
  let harness: ReturnType<typeof createTestApp>;
  let admin: string;
  let support: string;
  let customer: string;

  beforeAll(async () => {
    harness = createTestApp(db, { env: envWith({}) });
    admin = await signInWithPhone(harness, '+919844600001');
    support = await signInWithPhone(harness, '+919844600002');
    customer = await signInWithPhone(harness, '+919844600003');
    await setRole('+919844600001', 'admin');
    await setRole('+919844600002', 'support');
  });

  const post = (bearer: string, body: FormData) => harness.app.request('/v1/admin/uploads', { method: 'POST', headers: { authorization: `Bearer ${bearer}` }, body });

  it('saves an image, lists it and serves it from the API', async () => {
    const response = await post(support, form(png, 'cover.png', 'A beach'));
    expect(response.status).toBe(201);
    const saved = (await response.json()) as { id: string; url: string; driver: string; width: number; alt: string };
    expect(saved).toMatchObject({ driver: 'disk', width: 1, alt: 'A beach' });
    expect(saved.url).toMatch(/^https:\/\/api\.example\.com\/v1\/uploads\/images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);

    const list = (await (await harness.app.request('/v1/admin/uploads', { headers: { authorization: `Bearer ${admin}` } })).json()) as { id: string }[];
    expect(list.map((item) => item.id)).toContain(saved.id);

    const file = await harness.app.request(new URL(saved.url).pathname);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(file.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(png);
  });

  it('refuses non-images, big files, customers and path tricks', async () => {
    expect((await post(admin, form(new TextEncoder().encode('<svg onload="alert(1)"></svg>'.padEnd(40)), 'x.svg'))).status).toBe(415);
    const big = new Uint8Array(1024 * 1024 + 200 * 1024);
    big.set(png);
    expect((await post(admin, form(big))).status).toBe(413);
    expect((await post(customer, form(png))).status).toBe(403);
    expect((await harness.app.request('/v1/uploads/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
    expect((await harness.app.request('/v1/uploads/images/2026/01/not-a-real-file.png')).status).toBe(404);
  });

  it('lets admins delete, which removes the file', async () => {
    const saved = (await (await post(admin, form(gif, 'tiny.gif'))).json()) as { id: string; url: string };
    expect((await harness.app.request(`/v1/admin/uploads/${saved.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${support}` } })).status).toBe(403);
    expect((await harness.app.request(`/v1/admin/uploads/${saved.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${admin}` } })).status).toBe(204);
    expect((await harness.app.request(new URL(saved.url).pathname)).status).toBe(404);
  });
});

describe('S3 storage', () => {
  const s3 = { S3_BUCKET: 'vela-media', S3_ACCESS_KEY_ID: 'key', S3_SECRET_ACCESS_KEY: 'secret', S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com', S3_PUBLIC_URL: 'https://media.example.com' };

  it('signs a PUT to the bucket and returns the public URL', async () => {
    const calls: Request[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push(new Request(input instanceof Request ? input : String(input), init));
      return new Response('', { status: 200 });
    });
    try {
      const storage = createStorage(envWith(s3), silentLogger);
      expect(storage.primary).toBe('s3');
      const stored = await storage.put('images/2026/11/abc.png', png, 'image/png');
      expect(stored).toEqual({ key: 'images/2026/11/abc.png', url: 'https://media.example.com/images/2026/11/abc.png', driver: 's3' });
      expect(calls[0]?.method).toBe('PUT');
      expect(calls[0]?.url).toBe('https://vela-media.acct.r2.cloudflarestorage.com/images/2026/11/abc.png');
      expect(calls[0]?.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
      expect(calls[0]?.headers.get('content-type')).toBe('image/png');
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to the server disk when the bucket fails', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<Error>AccessDenied</Error>', { status: 403 }));
    try {
      const storage = createStorage(envWith(s3), silentLogger);
      const stored = await storage.put('images/2026/11/11111111-1111-1111-1111-111111111111.png', png, 'image/png');
      expect(stored.driver).toBe('disk');
      expect(await storage.readDisk(stored.key)).toEqual(png);
    } finally {
      spy.mockRestore();
    }
  });

  it('uses path-style URLs for MinIO and refuses half-set S3 settings', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      calls.push(String(input instanceof Request ? input.url : input));
      return new Response('', { status: 200 });
    });
    try {
      const storage = createStorage(envWith({ ...s3, S3_ENDPOINT: 'http://minio:9000', S3_PUBLIC_URL: '', S3_FORCE_PATH_STYLE: 'true' }), silentLogger);
      const stored = await storage.put('images/2026/11/abc.png', png, 'image/png');
      expect(calls[0]).toBe('http://minio:9000/vela-media/images/2026/11/abc.png');
      expect(stored.url).toBe('http://minio:9000/vela-media/images/2026/11/abc.png');
    } finally {
      spy.mockRestore();
    }
    expect(() => envWith({ S3_BUCKET: 'only-bucket' })).toThrow(/S3_BUCKET/);
    expect(createStorage(envWith({ ...s3, STORAGE_DRIVER: 'disk' }), silentLogger).primary).toBe('disk');
  });
});
