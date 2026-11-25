import type { BlogPost, BlogPostSummary } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, profile, user } from '../src/db/schema';
import { createTestApp, createTestDb, signInWithPhone } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let admin: string;
let support: string;
let customer: string;

async function setRole(phone: string, role: 'customer' | 'support' | 'admin') {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
  await db.update(profile).set({ role }).where(eq(profile.userId, row?.id ?? ''));
}

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  harness = createTestApp(db);
  admin = await signInWithPhone(harness, '+919844400001');
  support = await signInWithPhone(harness, '+919844400002');
  customer = await signInWithPhone(harness, '+919844400003');
  await setRole('+919844400001', 'admin');
  await setRole('+919844400002', 'support');
});

afterAll(async () => {
  await close();
});

const call = (method: string, path: string, bearer: string | null, body?: unknown) =>
  harness.app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const draft = (slug: string, extra: Record<string, unknown> = {}) => ({
  locale: 'en',
  slug,
  title: 'Install an eSIM on iPhone',
  excerpt: 'Two minutes at home, data the moment you land.',
  body: '## Before you start\n\nCheck your phone is unlocked.',
  author_name: 'The vela team',
  tags: ['Guides', 'Guides', ' iPhone '],
  country_codes: ['jp'],
  ...extra,
});

type AdminPost = BlogPost & { id: string; status: string; published_at: string | null };

describe('blog', () => {
  it('keeps drafts and scheduled posts off the public feed', async () => {
    const created = await call('POST', '/v1/admin/blog', admin, draft('hidden-draft'));
    expect(created.status).toBe(201);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await call('POST', '/v1/admin/blog', admin, draft('scheduled-post', { status: 'published', published_at: future }));

    const feed = (await (await call('GET', '/v1/blog/posts?locale=en', null)).json()) as BlogPostSummary[];
    expect(feed.map((item) => item.slug)).not.toContain('hidden-draft');
    expect(feed.map((item) => item.slug)).not.toContain('scheduled-post');
    expect((await call('GET', '/v1/blog/posts/hidden-draft?locale=en', null)).status).toBe(404);
  });

  it('publishes with SEO fields and serves them publicly', async () => {
    const response = await call(
      'POST',
      '/v1/admin/blog',
      admin,
      draft('install-esim-iphone', {
        status: 'published',
        meta_title: 'Install a travel eSIM on iPhone',
        meta_description: '',
        keywords: ['Install eSIM', 'install esim'],
        og_image: '/og.png',
      }),
    );
    const created = (await response.json()) as AdminPost;
    expect(created.status).toBe('published');
    expect(created.published_at).not.toBeNull();
    expect(created.tags).toEqual(['Guides', 'iPhone']);
    expect(created.country_codes).toEqual(['JP']);

    const post = (await (await call('GET', '/v1/blog/posts/install-esim-iphone?locale=en', null)).json()) as BlogPost;
    expect(post.seo).toEqual({
      meta_title: 'Install a travel eSIM on iPhone',
      meta_description: null,
      canonical_url: null,
      og_image: '/og.png',
      keywords: ['install esim'],
      noindex: false,
    });
    expect(post.reading_minutes).toBeGreaterThanOrEqual(1);
    expect((await call('GET', '/v1/blog/posts/install-esim-iphone?locale=ar', null)).status).toBe(404);
  });

  it('keeps saved fields on a partial update', async () => {
    const created = (await (await call('POST', '/v1/admin/blog', admin, draft('partial-edit', { tags: ['Money'] }))).json()) as AdminPost;
    const updated = (await (await call('PATCH', `/v1/admin/blog/${created.id}`, admin, { title: 'A new title' })).json()) as AdminPost;
    expect(updated.title).toBe('A new title');
    expect(updated.tags).toEqual(['Money']);
    expect(updated.status).toBe('draft');
  });

  it('rejects a duplicate slug in the same language and bad input', async () => {
    expect((await call('POST', '/v1/admin/blog', admin, draft('install-esim-iphone'))).status).toBe(409);
    expect((await call('POST', '/v1/admin/blog', admin, draft('install-esim-iphone', { locale: 'ar' }))).status).toBe(201);
    expect((await call('POST', '/v1/admin/blog', admin, draft('Bad Slug!'))).status).toBe(400);
    expect((await call('POST', '/v1/admin/blog', admin, draft('bad-canonical', { canonical_url: 'http://x.com' }))).status).toBe(400);
  });

  it('lets support write drafts but not publish or delete', async () => {
    expect((await call('GET', '/v1/admin/blog', customer)).status).toBe(403);
    const created = await call('POST', '/v1/admin/blog', support, draft('support-draft'));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as AdminPost;
    expect((await call('PATCH', `/v1/admin/blog/${id}`, support, { status: 'published' })).status).toBe(403);
    expect((await call('DELETE', `/v1/admin/blog/${id}`, support)).status).toBe(403);
    expect((await call('DELETE', `/v1/admin/blog/${id}`, admin)).status).toBe(204);
    expect((await call('GET', `/v1/admin/blog/${id}`, admin)).status).toBe(404);
    const trail = await db.select().from(auditLog).where(eq(auditLog.target, `blog:${id}`));
    expect(trail.map((item) => item.action).sort()).toEqual(['blog.create', 'blog.delete']);
  });
});
