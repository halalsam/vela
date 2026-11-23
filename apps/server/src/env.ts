import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 32 bytes as 64 hex characters'),
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  GIT_SHA: z.string().default('dev'),
  ESIM_PROVIDER: z.enum(['mock']).default('mock'),
  API_PUBLIC_URL: z.url().default('http://localhost:8787'),
  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  COOKIE_DOMAIN: optional,
  APPLE_BUNDLE_ID: z.string().default('com.vela.app'),
  APPLE_SERVICE_ID: optional,
  APPLE_CLIENT_SECRET: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_IOS_CLIENT_ID: optional,
  SMS_ROUTE: z.enum(['console', 'live']).default('console'),
  MSG91_AUTH_KEY: optional,
  MSG91_TEMPLATE_ID: optional,
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_FROM: optional,
  MOCK_USAGE_SPEED: z.coerce.number().min(1).max(100_000).default(1),
  PUSH_ROUTE: z.enum(['console', 'live']).default('console'),
  APNS_KEY_ID: optional,
  APNS_TEAM_ID: optional,
  APNS_PRIVATE_KEY: optional,
  APNS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  FCM_SERVICE_ACCOUNT: optional,
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,
  PRICING_MARGIN_PERCENT: z.coerce.number().min(0).max(300).default(40),
});

const checkedEnvSchema = envSchema.superRefine((env, context) => {
  if (env.PUSH_ROUTE === 'live' && !(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY)) {
    context.addIssue({ code: 'custom', path: ['APNS_KEY_ID'], message: 'live push needs an APNs key ID, team ID and private key' });
  }
  if (env.PUSH_ROUTE === 'live' && !env.FCM_SERVICE_ACCOUNT) {
    context.addIssue({ code: 'custom', path: ['FCM_SERVICE_ACCOUNT'], message: 'live push needs a Firebase service account for Android' });
  }
  if (env.APP_ENV === 'production' && env.PAYMENT_PROVIDER === 'mock') {
    context.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'production must take real payments' });
  }
  if (env.PAYMENT_PROVIDER === 'razorpay' && !(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET)) {
    context.addIssue({ code: 'custom', path: ['RAZORPAY_KEY_ID'], message: 'Razorpay needs a key ID, key secret and webhook secret' });
  }
  if (env.APP_ENV === 'production' && env.SMS_ROUTE !== 'live') {
    context.addIssue({ code: 'custom', path: ['SMS_ROUTE'], message: 'production must send real SMS' });
  }
  if (env.SMS_ROUTE === 'live' && !(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)) {
    context.addIssue({ code: 'custom', path: ['TWILIO_ACCOUNT_SID'], message: 'live SMS needs Twilio for non-Indian numbers' });
  }
  if (env.SMS_ROUTE === 'live' && !(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID)) {
    context.addIssue({ code: 'custom', path: ['MSG91_AUTH_KEY'], message: 'live SMS needs MSG91 for Indian numbers' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = checkedEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
