# vela backend plan

Status: proposed · 2026-11-20 · replaces "Medusa v2" from the original brief

## 1. Summary

A lean TypeScript backend in the monorepo, `apps/server`, running on the VPS with Postgres. One
codebase serves the app, the website and a small admin. The contract is the set of zod schemas that
already exist in `packages/api`, so the mock API the app runs on today becomes the specification.
The server implements the same `VelaApi` interface over HTTP.

What it does:

- Sells eSIM plans and top-ups in INR, AED and SAR, with coupons, GST and referral credit.
- Buys the eSIM from the provider after payment, stores the activation details encrypted, and
  refunds automatically if the provider fails.
- Tracks usage and expiry, sends low-data and expiry pushes, and keeps Live Activities current
  while the app is closed.
- Signs people in with Apple, Google or a phone code.
- Gives the team an admin for orders, eSIMs, refunds, coupons, margins and webhook logs.

Out of scope for v1: resellers and B2B pricing, physical goods, in-app chat built by us (Chatwoot
covers it), multi-provider routing per plan (the adapter allows it later).

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node 22 LTS, TypeScript | Same toolchain as the monorepo |
| HTTP | Hono + `@hono/node-server` | `@hono/zod-openapi` generates OpenAPI from the zod schemas |
| Database | PostgreSQL 16 | One database per environment |
| ORM / migrations | Drizzle + drizzle-kit | Typed queries; SQL migrations committed to git |
| Jobs and cron | pg-boss | Queue inside Postgres, so no Redis; retries, backoff, schedules |
| Auth | better-auth (+ `@better-auth/expo`) | Apple, Google, phone OTP, bearer sessions for the app, cookies for the web |
| SMS | MSG91 for +91, Twilio Verify elsewhere | Behind one `SmsSender` interface |
| Payments | Razorpay (India); Gulf provider chosen in B5 | Behind one `PaymentProvider` interface |
| eSIM provider | Chosen in B1 | Behind one `EsimProvider` interface |
| Push | APNs (token auth, `.p8`) and FCM HTTP v1 | APNs also drives Live Activity updates |
| Email | Resend or Amazon SES | Receipt with QR, GST invoice |
| Files | S3-compatible bucket (Cloudflare R2 or Backblaze B2) | Invoices, backups |
| Support | Chatwoot | Cloud to start; self-host later if cost matters |
| Monitoring | Sentry (server, app, web), uptime checks | Alerts on job failures |
| Hosting | Docker Compose on the VPS, Caddy for HTTPS | Staging and production as separate Compose projects |
| CI/CD | GitHub Actions → image on GHCR → deploy over SSH | Migrations run before the new image starts |

Check the current major versions of each package when scaffolding; pin exact versions.

## 3. Repository layout

```
apps/
  server/
    src/
      app.ts                 Hono app, middleware, route mounting
      env.ts                 zod-validated environment
      db/
        schema/*.ts          Drizzle tables
        migrations/          generated SQL
      auth/                  better-auth config, SMS sender
      modules/
        catalog/             countries, regions, plans, pricing, sync job
        orders/              order state machine, coupons, tax
        payments/            PaymentProvider + razorpay/, gulf/
        esims/               EsimProvider + provider adapter, provisioning, usage
        rewards/             referral codes, credit ledger
        notifications/       push (APNs, FCM), email, Live Activity tokens
        invoices/            numbering, PDF, storage
        admin/               admin routes
      jobs/                  pg-boss setup, schedules, handlers
      lib/                   crypto (AES-GCM), money, idempotency, errors
    test/
    Dockerfile
packages/
  api/                       schemas (existing) + createHttpApi (new)
infra/
  compose.staging.yml
  compose.production.yml
  Caddyfile
```

The server and the worker are the same image started with different commands
(`node dist/server.js` and `node dist/worker.js`), so a slow job never blocks a request.

## 4. Data model

All money is stored as integer minor units (paise, fils, halalas) with a currency column. Timestamps
are `timestamptz`.

| Table | Key columns |
|---|---|
| `user`, `session`, `account`, `verification` | Managed by better-auth |
| `profile` | `user_id`, `name`, `email`, `phone`, `language`, `currency`, `referral_code`, `referred_by` |
| `country` | `code`, `name_en`, `name_ar`, `region_id`, `popular` |
| `region` | `id`, `name_en`, `name_ar`, `type` (`regional` / `global`) |
| `plan` | `id`, `provider_plan_ref`, `type`, `country_codes[]`, `data_mb`, `validity_days`, `is_5g`, `hotspot`, `networks[]`, `cost_minor`, `cost_currency`, `active`, `synced_at` |
| `plan_price` | `plan_id`, `currency`, `amount_minor` (margin applied; editable in admin) |
| `coupon` | `code`, `kind` (`percent` / `amount`), `value`, `currency`, `max_redemptions`, `per_user_limit`, `starts_at`, `ends_at`, `country_codes[]` |
| `order` | `id`, `user_id`, `kind` (`esim` / `top_up`), `plan_id`, `esim_id`, `status`, `currency`, `subtotal_minor`, `discount_minor`, `credit_minor`, `tax_minor`, `total_minor`, `coupon_code`, `idempotency_key` |
| `payment` | `order_id`, `provider`, `provider_order_id`, `provider_payment_id`, `status`, `amount_minor`, `raw` (jsonb) |
| `esim` | `id`, `user_id`, `iccid`, `plan_id`, `provider_ref`, `status`, `data_used_mb`, `data_total_mb`, `activated_at`, `expires_at`, `lpa_enc`, `activation_code_enc`, `smdp`, `label` |
| `usage_snapshot` | `esim_id`, `date`, `used_mb` (one row per day, for the 7-day chart) |
| `credit_ledger` | `user_id`, `amount_minor`, `currency`, `reason`, `order_id` (append-only) |
| `device` | `user_id`, `platform`, `push_token`, `locale`, `last_seen_at` |
| `live_activity` | `esim_id`, `device_id`, `push_token`, `started_at`, `ended_at` |
| `invoice` | `order_id`, `number` (sequential per financial year), `gstin`, `pdf_key` |
| `webhook_event` | `provider`, `event_id` (unique), `type`, `payload`, `processed_at`, `error` |
| `audit_log` | `actor_id`, `action`, `target`, `data`, `created_at` (every admin action) |

Activation codes and LPA strings are encrypted with AES-256-GCM. The key lives in the server
environment, never in the database.

## 5. Order lifecycle

```
draft ──create──▶ awaiting_payment ──payment.captured──▶ paid ──job──▶ provisioning
                        │                                                  │
                    expired (30 min)                          ┌────────────┴───────────┐
                                                              ▼                        ▼
                                                          fulfilled           provisioning_failed
                                                                                       │
                                                                                 refund job
                                                                                       ▼
                                                                                    refunded
```

- `POST /v1/orders` takes an `Idempotency-Key` header. A repeated key returns the same order.
- Webhook events are stored by `event_id` before processing, so replays are harmless.
- Provisioning calls the provider with the order ID as its idempotency key. It retries 3 times
  with backoff, then marks the order failed and queues the refund.
- Fulfilment writes the eSIM, sends the receipt email with the QR, generates the invoice, credits
  any referrer once the eSIM first connects, and pushes "your eSIM is ready".

## 6. Payment flow (Razorpay)

1. App: the user swipes to pay. `POST /v1/orders` → server prices the order (plan price, coupon,
   credit, GST) and creates a Razorpay order. It returns `{ orderId, razorpayOrderId, amount, key }`.
2. App: opens Razorpay Checkout (`react-native-razorpay` with an Expo config plugin; UPI, cards,
   netbanking). On success it sends the payment ID and signature to
   `POST /v1/orders/:id/confirm`.
3. Server: verifies the signature, marks the payment `captured`, queues `esim.provision`. The app
   navigates to Processing and polls `GET /v1/orders/:id` (or waits for the push).
4. The Razorpay `payment.captured` webhook does the same as step 3 and is the source of truth if
   the app is killed mid-payment.

The Gulf provider (AED, SAR, Apple Pay) follows the same `PaymentProvider` interface:
`createPayment`, `verifyClientResult`, `parseWebhook`, `refund`.

## 7. eSIM provider adapter

```ts
interface EsimProvider {
  listPlans(): Promise<ProviderPlan[]>;
  purchase(input: { planRef: string; idempotencyKey: string }): Promise<{ iccid: string; lpa: string; providerRef: string }>;
  topUp(input: { iccid: string; packRef: string; idempotencyKey: string }): Promise<void>;
  usage(iccid: string): Promise<{ usedMb: number; totalMb: number; status: EsimStatus; activatedAt?: Date; expiresAt?: Date }>;
  parseWebhook(request: Request): Promise<ProviderEvent | null>;
}
```

Provider selection (B1). Score each candidate on:

- Coverage and network quality in the top destinations for Indian and Gulf travellers.
- Wholesale price per GB, and settlement currency.
- Usage webhooks (vs polling only), top-up support on the same ICCID, and validity that starts on
  first connection.
- Sandbox quality, API stability, rate limits, SLA and support.
- Whether it returns an LPA string (needed for the iOS one-tap install link).

## 8. Background jobs (pg-boss)

| Job | Trigger | Does |
|---|---|---|
| `catalog.sync` | every 6 h | Pull provider plans, upsert `plan`, deactivate missing ones, flag price changes in admin |
| `esim.provision` | payment captured | Purchase, store, email, invoice, push |
| `esim.refund` | provisioning failed | Refund through the payment provider |
| `esim.usage` | every 15 min for active eSIMs; on provider webhook | Update usage, write daily snapshot, fan out the next three jobs when needed |
| `notify.low_data` | crossing 15% or 512 MB | Push once per threshold |
| `notify.expiry` | 24 h and 2 h before `expires_at` | Push |
| `liveactivity.push` | usage or status change | APNs `liveactivity` push to every open activity for that eSIM; `end` event on expiry |
| `invoice.generate` | fulfilled | PDF to the bucket, link in email |
| `orders.expire` | every 5 min | Expire unpaid orders older than 30 min |
| `backup.verify` | daily | Restore last night's dump into a scratch database and run a sanity query |

Failed jobs go to a dead-letter queue and raise a Sentry alert.

## 9. Auth

- better-auth with the Apple and Google social providers and the phone-number OTP plugin.
- The app keeps a bearer session in `expo-secure-store` (`@better-auth/expo`); the website uses
  HTTP-only cookies.
- OTP: 6 digits, 5-minute expiry, 5 attempts. Rate-limited per number and per IP.
- Roles: `customer`, `support`, `admin`. Admin routes require `support` or `admin` and write to
  `audit_log`.
- Account deletion endpoint (App Store requirement): deletes the profile, keeps orders and
  invoices for tax law with the user detached.

## 10. API (v1)

REST, JSON, validated by the same zod schemas, documented at `/v1/openapi.json`.

| Method | Path | Maps to `VelaApi` |
|---|---|---|
| GET | `/v1/catalog/countries` | `getCountries` |
| GET | `/v1/catalog/regions` | `getRegions` |
| GET | `/v1/catalog/plans?country=JP` | `getPlans` |
| GET | `/v1/catalog/regions/:id/plans` | `getRegionPlans` |
| GET | `/v1/catalog/plans/:id` | `getPlan` |
| GET | `/v1/offers` | `getOffers` |
| POST | `/v1/coupons/validate` | `redeemCoupon` |
| POST | `/v1/orders` | `createOrder` (now returns payment details) |
| POST | `/v1/orders/:id/confirm` | new: client payment result |
| GET | `/v1/orders/:id` | new: order status for Processing |
| GET | `/v1/esims` | `getEsims` |
| GET | `/v1/esims/:iccid` | `getEsim` |
| GET | `/v1/esims/:iccid/usage/daily` | `getDailyUsage` |
| GET | `/v1/esims/:iccid/top-ups` | `getTopUpPacks` |
| POST | `/v1/esims/:iccid/top-ups` | `topUp` (creates a top-up order) |
| GET | `/v1/me` | `getProfile` |
| DELETE | `/v1/me` | new: account deletion |
| GET | `/v1/rewards` | `getRewards` |
| POST | `/v1/devices` | new: register push token |
| POST | `/v1/esims/:iccid/live-activity` | new: register Live Activity push token |
| * | `/v1/auth/*` | better-auth |
| POST | `/v1/webhooks/razorpay`, `/v1/webhooks/gulf`, `/v1/webhooks/esim` | provider webhooks |
| * | `/v1/admin/*` | admin |

Support chat moves to Chatwoot, so `getSupportThread` and `sendSupportMessage` are replaced by the
Chatwoot SDK in the app.

## 11. Client changes

- `packages/api`: add `createHttpApi({ baseUrl, getToken })` implementing `VelaApi` with fetch
  and zod parsing. Keep `createMockApi` for the dev scenario switcher and tests.
- Mobile: `EXPO_PUBLIC_API_URL` picks the HTTP client; the dev scenario switcher keeps working
  against mocks.
- Mobile: Razorpay checkout behind swipe to pay; `expo-notifications` for push; the Live Activity
  module switches to `pushType: .token` and posts the token to the server.
- Web: server components call the HTTP API with ISR (revalidate catalog every 10 minutes);
  checkout uses Razorpay's web checkout; `/admin` pages for staff.

## 12. Tax and invoices

- India: GST 18%, prices shown inclusive. Invoices carry the GSTIN, a sequential number per
  financial year (`VL/2026-27/000123`) and the place of supply.
- Gulf customers: depends on which entity sells to them (UAE VAT 5%, KSA VAT 15%). Tax rate is a
  per-currency setting in the pricing module.
- **Get an accountant to confirm** the GST treatment of eSIM data sold to Indian residents for use
  abroad, and the setup for Gulf customers, before launch.

## 13. Security and privacy

- Secrets in a root-only `.env` per environment on the VPS; rotate on staff changes.
- Webhook signatures verified for every provider; requests without a valid signature are dropped.
- Activation codes encrypted at rest; never logged; only returned to the owning user.
- Rate limits on auth, coupon validation and order creation.
- Postgres reachable only on the Docker network; SSH key-only; automatic security updates.
- Nightly encrypted `pg_dump` to the bucket, 30-day retention, restore test daily (see jobs).
- Personal data limited to name, email, phone and device tokens. Plan for India's DPDP Act and
  UAE PDPL: a privacy policy, deletion on request, and data processing terms with each provider.

## 14. Infrastructure

```
VPS (4 vCPU, 8 GB RAM, 160 GB SSD to start)
├── caddy            HTTPS for api.<domain>, staging-api.<domain>
├── server           Hono API (2 replicas behind Caddy)
├── worker           pg-boss consumer
├── postgres         16, volume on SSD
└── (staging stack with its own Postgres)
```

- The website can stay on the VPS (Next.js standalone build) or move to Vercel later; it only
  talks to the API.
- Deploy: on push to `main`, CI builds and tests, pushes the image, then SSHes to the VPS:
  `docker compose pull && docker compose run --rm server migrate && docker compose up -d`.
- Rollback: redeploy the previous image tag. Migrations must be backwards compatible for one
  release.

## 15. Testing

- Unit (vitest): pricing, coupons, tax, credit, order state machine, encryption, webhook parsing.
- Integration: the Hono app against a real Postgres in Docker, with the provider and payment
  adapters stubbed. Run in CI.
- Contract tests against the eSIM provider sandbox and Razorpay test mode, run nightly.
- Webhook fixtures recorded from sandboxes and replayed in tests.
- The existing app and web code tests against `createMockApi` stay unchanged.

## 16. Milestones

Each milestone ends deployed to staging and demoable in a dev build.

| # | Milestone | Done when |
|---|---|---|
| B1 | Provider choice | Provider picked using section 7; sandbox keys in hand |
| B2 | Server skeleton | `apps/server` running on staging with Postgres, migrations, health check, Sentry, CI deploy |
| B3 | Catalog | Real plans synced; app and web read catalog from the API |
| B4 | Auth | Apple, Google and phone sign-in from the app; sessions on the web |
| B5 | Checkout and provisioning | Pay with Razorpay test mode → eSIM provisioned in sandbox → receipt email; failure path refunds |
| B6 | Usage and push | Usage sync, low-data and expiry pushes, Live Activity updates with the app closed |
| B7 | Top-ups, coupons, rewards | Top-up on the same eSIM; coupons and referral credit end to end |
| B8 | Invoices, admin, support | GST invoices, admin for orders, refunds and coupons, Chatwoot in the app |
| B9 | Production | Gulf payment provider live, backups verified, privacy policy, production keys, soft launch |

## 17. Inputs needed

1. eSIM provider: existing account or shortlist to evaluate.
2. Legal entity, GSTIN, and which entity sells to Gulf customers.
3. Gulf payment provider preference (Checkout.com, Tap, Stripe UAE, other).
4. SMS provider accounts (MSG91, Twilio).
5. Domain names for the API and website.
6. Apple Developer team (also needed for widgets), APNs key, Firebase project for FCM.
7. VPS provider and region (close to India and the Gulf, e.g. Mumbai or the UAE).
