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
  ESIM_PROVIDER: z.enum(['mock', 'esimaccess']).default('mock'),
  ESIM_ACCESS_CODE: optional,
  ESIM_ACCESS_WEBHOOK_TOKEN: optional,
  ESIM_ACCESS_WEBHOOK_IP_CHECK: z.stringbool().default(false),
  ESIM_BACKUP_PROVIDER: z.enum(['none', 'esimgo']).default('none'),
  ESIM_GO_API_KEY: optional,
  API_PUBLIC_URL: z.url().default('http://localhost:8787'),
  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  COOKIE_DOMAIN: optional,
  APPLE_BUNDLE_ID: z.string().default('com.sammk21.vela'),
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
  EMAIL_ROUTE: z.enum(['console', 'live']).default('console'),
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  APNS_KEY_ID: optional,
  APNS_TEAM_ID: optional,
  APNS_PRIVATE_KEY: optional,
  APNS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  FCM_SERVICE_ACCOUNT: optional,
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  SELLER_NAME: z.string().default('vela'),
  SELLER_GSTIN: optional,
  SELLER_ADDRESS: z.string().default(''),
  SELLER_STATE: z.string().default(''),
  INVOICE_PREFIX: z.string().regex(/^[A-Z]{1,6}$/).default('VL'),
  INVOICE_SAC: z.string().default('9984'),
  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,
  PRICING_MARGIN_PERCENT: z.coerce.number().min(0).max(300).default(40),
  // Image uploads. "auto" uses S3 when a bucket and keys are set and the server's disk otherwise; an S3 upload that
  // fails also falls back to disk. Works with AWS S3, Cloudflare R2, Backblaze B2 and MinIO.
  STORAGE_DRIVER: z.enum(['auto', 's3', 'disk']).default('auto'),
  S3_BUCKET: optional,
  S3_REGION: z.string().default('auto'),
  /** Leave empty for AWS. R2: https://<account>.r2.cloudflarestorage.com. MinIO: its URL. */
  S3_ENDPOINT: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  /** Public base URL for uploaded files (CDN, r2.dev or custom domain). Empty uses the bucket URL. */
  S3_PUBLIC_URL: optional,
  /** Path-style URLs (endpoint/bucket/key). MinIO needs this; AWS and R2 don't. */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_MB: z.coerce.number().min(1).max(50).default(8),
});

const checkedEnvSchema = envSchema.superRefine((env, context) => {
  if (env.EMAIL_ROUTE === 'live' && !(env.RESEND_API_KEY && env.EMAIL_FROM)) {
    context.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'live email needs a Resend API key and a from address' });
  }
  if (env.ESIM_BACKUP_PROVIDER === 'esimgo' && !env.ESIM_GO_API_KEY) {
    context.addIssue({ code: 'custom', path: ['ESIM_GO_API_KEY'], message: 'eSIM Go needs its API key' });
  }
  if (env.ESIM_PROVIDER === 'esimaccess' && !env.ESIM_ACCESS_CODE) {
    context.addIssue({ code: 'custom', path: ['ESIM_ACCESS_CODE'], message: 'eSIM Access needs its access code' });
  }
  if (env.APP_ENV === 'production' && env.ESIM_PROVIDER === 'mock') {
    context.addIssue({ code: 'custom', path: ['ESIM_PROVIDER'], message: 'production must sell real eSIMs' });
  }
  if (env.PUSH_ROUTE === 'live' && !(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_PRIVATE_KEY)) {
    context.addIssue({ code: 'custom', path: ['APNS_KEY_ID'], message: 'live push needs an APNs key ID, team ID and private key' });
  }
  if (env.PUSH_ROUTE === 'live' && !env.FCM_SERVICE_ACCOUNT) {
    context.addIssue({ code: 'custom', path: ['FCM_SERVICE_ACCOUNT'], message: 'live push needs a Firebase service account for Android' });
  }
  if (env.APP_ENV === 'production' && !(env.SELLER_GSTIN && env.SELLER_ADDRESS && env.SELLER_STATE)) {
    context.addIssue({ code: 'custom', path: ['SELLER_GSTIN'], message: 'production invoices need the seller GSTIN, address and state' });
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
  const s3Partly = env.S3_BUCKET || env.S3_ACCESS_KEY_ID || env.S3_SECRET_ACCESS_KEY;
  const s3Fully = env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY;
  if ((env.STORAGE_DRIVER === 's3' || s3Partly) && env.STORAGE_DRIVER !== 'disk' && !s3Fully) {
    context.addIssue({ code: 'custom', path: ['S3_BUCKET'], message: 'S3 uploads need S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY' });
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
