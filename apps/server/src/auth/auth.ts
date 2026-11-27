import { randomInt } from 'node:crypto';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, phoneNumber } from 'better-auth/plugins';
import type { Database } from '../db/client';
import { account, profile, session, user, verification } from '../db/schema';
import type { Env } from '../env';
import type { Logger } from '../logger';
import type { SmsSender } from '../integrations/sms';

export const PHONE_EMAIL_DOMAIN = 'phone.vela.invalid';
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const E164 = /^\+[1-9]\d{7,14}$/;

export function referralCode(): string {
  return Array.from({ length: 6 }, () => REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)]).join('');
}

export function appOrigins(env: Pick<Env, 'CORS_ORIGINS' | 'APP_ENV'>): string[] {
  return [...env.CORS_ORIGINS, 'vela://', ...(env.APP_ENV === 'local' ? ['exp://'] : [])];
}

type AuthDeps = { db: Database; env: Env; logger: Logger; sms: SmsSender };

export function createAuth({ db, env, logger, sms }: AuthDeps) {
  const appleAudience = [env.APPLE_BUNDLE_ID, ...(env.APPLE_SERVICE_ID ? [env.APPLE_SERVICE_ID] : [])];
  const googleAudience = [env.GOOGLE_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID].filter((value): value is string => Boolean(value));

  return betterAuth({
    appName: 'vela',
    baseURL: env.API_PUBLIC_URL,
    basePath: '/v1/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),
    trustedOrigins: appOrigins(env),
    socialProviders: {
      apple: {
        clientId: env.APPLE_SERVICE_ID ?? env.APPLE_BUNDLE_ID,
        clientSecret: env.APPLE_CLIENT_SECRET ?? '',
        appBundleIdentifier: env.APPLE_BUNDLE_ID,
        audience: appleAudience,
      },
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: googleAudience, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
    },
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: env.NODE_ENV !== 'test',
      window: 60,
      max: 100,
      customRules: { '/phone-number/send-otp': { window: 60, max: 3 }, '/phone-number/verify': { window: 60, max: 10 } },
    },
    advanced: env.COOKIE_DOMAIN ? { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } } : {},
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        phoneNumberValidator: (value) => E164.test(value),
        sendOTP: async ({ phoneNumber: to, code }) => {
          await sms.sendCode(to, code);
        },
        signUpOnVerification: {
          getTempEmail: (value) => `${value.replace(/\D/g, '')}@${PHONE_EMAIL_DOMAIN}`,
          getTempName: () => 'Traveller',
        },
      }),
      bearer(),
      expo(),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            const phone = typeof created.phoneNumber === 'string' ? created.phoneNumber : null;
            await db
              .insert(profile)
              .values({
                userId: created.id,
                name: created.name === 'Traveller' ? null : created.name,
                email: created.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? null : created.email,
                phone,
                referralCode: referralCode(),
              })
              .onConflictDoNothing();
            logger.info({ userId: created.id }, 'profile created');
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
