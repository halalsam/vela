import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../src/lib/crypto';
import { fromMinor, inclusiveTax, percentOf, toMinor } from '../src/lib/money';
import { loadEnv } from '../src/env';
import { testKey } from './helpers';

describe('crypto', () => {
  it('round-trips activation codes', () => {
    const secret = 'LPA:1$smdp.example.com$K2-JP7Q-A91X-4410';
    const sealed = encrypt(secret, testKey);
    expect(sealed).not.toContain('K2-JP7Q');
    expect(decrypt(sealed, testKey)).toBe(secret);
  });

  it('uses a fresh IV each time', () => {
    expect(encrypt('same', testKey)).not.toBe(encrypt('same', testKey));
  });

  it('rejects tampering and the wrong key', () => {
    const sealed = encrypt('secret', testKey);
    const parts = sealed.split(':');
    const tampered = [...parts.slice(0, 3), Buffer.from('other').toString('base64url')].join(':');
    expect(() => decrypt(tampered, testKey)).toThrow();
    expect(() => decrypt(sealed, 'b'.repeat(64))).toThrow();
  });
});

describe('money', () => {
  it('converts between major and minor units', () => {
    expect(toMinor(1199, 'INR')).toBe(119900);
    expect(toMinor(19.99, 'AED')).toBe(1999);
    expect(fromMinor(119900, 'INR')).toBe(1199);
  });

  it('splits inclusive GST', () => {
    expect(inclusiveTax(95900, 0.18)).toBe(14629);
    expect(inclusiveTax(10000, 0)).toBe(0);
  });

  it('takes percentages in minor units', () => {
    expect(percentOf(119900, 20)).toBe(23980);
  });
});

describe('env', () => {
  it('rejects a short encryption key and a non-postgres URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x', ENCRYPTION_KEY: 'abc' })).toThrow(/Invalid environment/);
  });

  it('splits CORS origins', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgres://x',
      ENCRYPTION_KEY: testKey,
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      CORS_ORIGINS: 'https://a.com, https://b.com',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });
});
