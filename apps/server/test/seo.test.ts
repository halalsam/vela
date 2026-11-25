import type { SeoBundle } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profile, user } from '../src/db/schema';
import { createTestApp, createTestDb, signInWithPhone } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let admin: string;
let support: string;

async function setRole(phone: string, role: 'customer' | 'support' | 'admin') {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
  await db.update(profile).set({ role }).where(eq(profile.userId, row?.id ?? ''));
}

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  harness = createTestApp(db);
  admin = await signInWithPhone(harness, '+919844500001');
  support = await signInWithPhone(harness, '+919844500002');
  await setRole('+919844500001', 'admin');
  await setRole('+919844500002', 'support');
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

const site = {
  title_template: '%s | vela',
  twitter_site: '@vela',
  organization: { name: 'vela', email: 'hello@example.com', same_as: ['https://x.com/vela', ''] },
  verification: { google: 'abc123' },
  indexing: true,
  robots_disallow: ['/en/internal'],
  locales: { en: { default_title: 'vela travel eSIM', keywords: ['eSIM', 'esim '] }, ar: {} },
};

describe('seo', () => {
  it('serves empty defaults before anything is saved', async () => {
    const response = await call('GET', '/v1/seo?locale=en', null);
    expect(response.status).toBe(200);
    const bundle = (await response.json()) as SeoBundle;
    expect(bundle.pages).toEqual({});
    expect(bundle.site.indexing).toBe(true);
    expect(bundle.site.title_template).toBeNull();
  });

  it('lets admins save page overrides per language and reset them', async () => {
    const saved = await call('PUT', '/v1/admin/seo/pages/destination:jp/en', admin, {
      meta_title: 'Japan eSIM from {{price}}',
      meta_description: '',
      keywords: ['Japan eSIM', 'japan esim'],
      noindex: false,
      sitemap_priority: 0.9,
      structured_data: '{"@type":"Thing"}',
    });
    expect(saved.status).toBe(200);
    const en = (await (await call('GET', '/v1/seo?locale=en', null)).json()) as SeoBundle;
    expect(en.pages['destination:jp']).toMatchObject({ meta_title: 'Japan eSIM from {{price}}', meta_description: null, keywords: ['japan esim'], sitemap_priority: 0.9 });
    const ar = (await (await call('GET', '/v1/seo?locale=ar', null)).json()) as SeoBundle;
    expect(ar.pages['destination:jp']).toBeUndefined();

    expect((await call('DELETE', '/v1/admin/seo/pages/destination:jp/en', admin)).status).toBe(204);
    const after = (await (await call('GET', '/v1/seo?locale=en', null)).json()) as SeoBundle;
    expect(after.pages['destination:jp']).toBeUndefined();
  });

  it('rejects bad keys, broken JSON-LD and non-admin writes', async () => {
    expect((await call('PUT', '/v1/admin/seo/pages/Bad Key/en', admin, {})).status).toBe(400);
    expect((await call('PUT', '/v1/admin/seo/pages/home/en', admin, { structured_data: '{nope' })).status).toBe(400);
    expect((await call('PUT', '/v1/admin/seo/pages/home/en', support, { meta_title: 'x' })).status).toBe(403);
    expect((await call('GET', '/v1/admin/seo', support)).status).toBe(200);
  });

  it('saves site settings and cleans lists', async () => {
    const response = await call('PUT', '/v1/admin/seo/site', admin, site);
    expect(response.status).toBe(200);
    const bundle = (await (await call('GET', '/v1/seo?locale=en', null)).json()) as SeoBundle;
    expect(bundle.site).toMatchObject({
      title_template: '%s | vela',
      twitter_site: '@vela',
      organization: { name: 'vela', same_as: ['https://x.com/vela'] },
      verification: { google: 'abc123', bing: null },
      locales: { en: { default_title: 'vela travel eSIM', keywords: ['esim'] }, ar: { site_name: null } },
    });
    expect((await call('PUT', '/v1/admin/seo/site', admin, { ...site, title_template: 'no placeholder' })).status).toBe(400);
  });
});
