import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { referralCode } from '../src/auth/auth';
import { profile, user } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { createTestApp, createTestDb, testKey } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  harness = createTestApp(db);
});

afterAll(async () => {
  await close();
});

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  body: JSON.stringify(body),
});

async function signInWithPhone(phoneNumber: string) {
  const sent = await harness.app.request('/v1/auth/phone-number/send-otp', json({ phoneNumber }));
  expect(sent.status).toBe(200);
  const code = harness.sms.sent.findLast((item) => item.phoneNumber === phoneNumber)?.code;
  expect(code).toMatch(/^\d{6}$/);
  const verified = await harness.app.request('/v1/auth/phone-number/verify', json({ phoneNumber, code }));
  expect(verified.status).toBe(200);
  const token = verified.headers.get('set-auth-token');
  expect(token).toBeTruthy();
  return token ?? '';
}

describe('phone sign-in', () => {
  it('creates a user and profile on first verification and returns a bearer session', async () => {
    const token = await signInWithPhone('+919876543210');
    const me = await harness.app.request('/v1/me', { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ name: '', email: null, phone: '+919876543210', provider: 'phone' });
    const [row] = await db.select().from(profile);
    expect(row?.referralCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('signs the same number back into the same account', async () => {
    await signInWithPhone('+919876543210');
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it('rejects a wrong code and badly formatted numbers', async () => {
    await harness.app.request('/v1/auth/phone-number/send-otp', json({ phoneNumber: '+971501234567' }));
    const wrong = await harness.app.request('/v1/auth/phone-number/verify', json({ phoneNumber: '+971501234567', code: '000000' }));
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    const bad = await harness.app.request('/v1/auth/phone-number/send-otp', json({ phoneNumber: '98765' }));
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });
});

describe('/v1/me', () => {
  it('requires a session', async () => {
    const response = await harness.app.request('/v1/me');
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'unauthenticated', message: 'Sign in to continue' } });
  });

  it('deletes the account and its sessions', async () => {
    const token = await signInWithPhone('+966501234567');
    const deleted = await harness.app.request('/v1/me', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    expect(deleted.status).toBe(204);
    expect(await db.select().from(user).where(eq(user.phoneNumber, '+966501234567'))).toHaveLength(0);
    const after = await harness.app.request('/v1/me', { headers: { authorization: `Bearer ${token}` } });
    expect(after.status).toBe(401);
  });
});

describe('auth config', () => {
  it('makes readable referral codes', () => {
    const codes = new Set(Array.from({ length: 200 }, referralCode));
    expect(codes.size).toBeGreaterThan(195);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('refuses production without real SMS', () => {
    expect(() =>
      loadEnv({
        APP_ENV: 'production',
        DATABASE_URL: 'postgres://x',
        ENCRYPTION_KEY: testKey,
        BETTER_AUTH_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/production must send real SMS/);
  });
});
