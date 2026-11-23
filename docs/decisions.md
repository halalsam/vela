# Decisions

## 2026-11-20 · after the Phase 1 audit

The design export in `design/` ("Landed") is an iOS-native, light + dark, accent-free design. The
product brief asks for a dark "Charcoal" look. The logo kit (`packages/brand/logo`) is the brand
source of truth. Resolved as follows:

1. **Look.** Keep the design's layouts, flows and component set. Re-skin them in Charcoal: dark only,
   matte black `#0A0A0A`, surfaces `#121212 / #1A1A1A / #222222`, hairline borders at 7% white,
   Champagne `#C8B285` as the rare accent. Brief-only pieces (offers, processing, rewards, swipe to
   pay) are added in the same language.
2. **Type.** Manrope for UI, Instrument Serif for lowercase display titles, IBM Plex Sans Arabic for
   all Arabic. All three are OFL and bundled from `packages/brand/fonts`.
3. **Motion motif.** The splash, processing loop, success and pull-to-refresh build the mark the way
   the logo kit does: the sail sets, the signal arrives, the name lands. No constellation: the symbol
   has no stars or lines, and the guide forbids drawing it in outlines.
4. **Home.** Offers strip → My travel (the design's active eSIM card) → Explore grid (popular
   destinations and regions).
5. **Payments.** Swipe to pay (Razorpay, UPI) is the primary action. The official Apple Pay button
   shows where Apple Pay is available.
6. **iOS builds.** This machine is Linux. iOS dev builds go through EAS (`development-simulator`
   profile); running them needs a Mac with Xcode.
7. **Logo rules follow the kit, not the brief** where they differ: clear space = band width (6u),
   wordmark minimum 80px wide, small cut at 32px and below.

## Tooling

- Tailwind 3.4 on both apps so one preset (`@vela/tokens/tailwind`) drives NativeWind 4 and Next.js.
  Move both to Tailwind 4 together when NativeWind 5 is stable.
- Fonts are referenced by PostScript name (`Manrope-SemiBold`), so the same family string works on
  iOS, Android and the web.
- Inline styles are allowed only for animated values (Reanimated, Skia). Everything else uses
  classes.
- Country flags render as emoji in a circle for now. Swap in a flag asset set before launch.
- Prices and data always use Latin digits, in Arabic too. Number strings stay left-to-right.

## 2026-11-20 · Phase 5

- The iOS launch screen is plain matte black, so `<VelaSplash />` can build the mark from nothing
  on first frame. Android 12+ keeps its system splash with the symbol.
- Sign-in, payments and notifications are mocked. Apple, Google and phone sign-in all succeed after a
  short delay; OTP `000000` is the wrong-code path. The real Apple sheet, Razorpay and the
  notifications permission arrive with the backend.
- Every screen reads data through TanStack Query from the mock API. In dev builds, Profile →
  Developer → Data scenario switches all screens between default, loading, empty, error, offline,
  low data and expired.
- Language can be set in Profile. Switching between English and Arabic flips the layout on the next
  launch, as React Native requires.

## 2026-11-20 · Phase 7 (web)

- The site lives under `/en` and `/ar`. `proxy.ts` sends `/` to the visitor's language from
  `Accept-Language`. Arabic pages render `dir="rtl"` and switch to IBM Plex Sans Arabic.
- Home, all 26 destination pages (countries and regions) and account are prerendered. Checkout and
  success render on request.
- Checkout and account run on the same mock API as the app, in the browser. The order is handed to
  the success page through `sessionStorage`; sign-in is a demo that stores the email in
  `localStorage`. Both get replaced by the backend.
- App Store and Play buttons are disabled until the listings exist. Use Apple's and Google's official
  badges when they go live.
- The hero mark builds with the same sail → signal → name beats as the app, in pure CSS (an animated
  conic mask on the original paths). It is skipped under `prefers-reduced-motion`.

## 2026-11-20 · Phase 8 (widgets and Live Activity)

- One widget extension, `apps/mobile/targets/widget`, built by `@bacons/apple-targets` on prebuild.
  It holds the usage widget (small, medium, Lock Screen ring, rectangular and inline) and the trip
  Live Activity with its Dynamic Island layouts. Minimum iOS 16.4, same as the app.
- The app writes a JSON snapshot of the user's eSIMs to the App Group `group.com.vela.app` every time
  the eSIM list loads, then reloads the widget timelines. Strings are localised by the app before
  they are written, so the widget follows the app language.
- Live Activities start from Usage › "Show on Lock Screen" through the local module
  `apps/mobile/modules/vela-live-activity`. Running activities update whenever the eSIM list
  refreshes and end when the plan expires. Remote push updates come with the backend.
- The widget uses the vela symbol as a template image (rendered from the kit SVG) and the system
  font; Manrope is not bundled into the extension.
- Before the first device build: set `ios.appleTeamId` in `app.config.ts`, and register the App Group
  for both bundle IDs (`com.vela.app`, `com.vela.app.VelaWidgets`) in the Apple Developer portal.

## 2026-11-20 · Backend

- Custom TypeScript backend (`apps/server`: Hono, Drizzle, Postgres, pg-boss, better-auth) instead
  of Medusa v2. vela sells one digital item and then manages a long eSIM lifecycle; a commerce
  framework would cover the smaller part and fight us on carts and shipping. The shared zod schemas
  in `packages/api` stay the contract. Full plan: `docs/backend-plan.md`.
- B2 (2026-11-20): `apps/server` skeleton is in: env validation, pino logs, Sentry, health and
  readiness, OpenAPI at `/v1/openapi.json`, the full v1 schema as migration `0000_init`, pg-boss
  worker with a heartbeat job, Docker image, Compose stack for staging and production, Caddy, and
  CI that builds the image on every push to `main` and deploys to staging once `VPS_HOST` and the
  SSH secrets are set. better-auth tables arrive in B4, so `user_id` columns are plain text until
  then.
- B4 (2026-11-23): sign-in runs on better-auth (`/v1/auth/*`) with Apple (native ID token, bundle
  `com.vela.app`), Google (browser flow via the Expo plugin, enabled once client IDs are set) and
  phone codes (MSG91 for +91, Twilio elsewhere; `SMS_ROUTE=console` logs codes outside
  production). Phone-only accounts get a placeholder email on `phone.vela.invalid`. A profile with a
  referral code is created for every new user. `GET /v1/me` and `DELETE /v1/me` are live; deleting
  removes the user, sessions, profile and devices, and keeps orders and eSIMs for tax records. The
  app and website use the real flows when `EXPO_PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL` are set,
  otherwise the demo flows.
- B5 (2026-11-23): checkout runs on the server. `POST /v1/orders` (signed in, `Idempotency-Key`)
  prices the order with the same `priceBreakdown` the app shows, checks the coupon (dates,
  currency, countries, total and per-user limits) and creates a Razorpay order. The client pays in
  Razorpay Checkout (`react-native-razorpay` in the app, `checkout.js` on the website) and sends the
  result to `POST /v1/orders/:id/confirm`; the signed `payment.captured` webhook does the same if the
  app is closed, and events are stored by ID so replays do nothing. A paid order queues
  `esim.provision` (3 retries, the order ID as the provider's idempotency key); the last failure
  marks the order failed and queues `esim.refund`. Unpaid orders expire after 30 minutes but a late
  payment still counts. Razorpay takes INR only; AED and SAR wait for the Gulf provider.
  `PAYMENT_PROVIDER=mock` (refused in production) skips the payment sheet. Not in B5 yet: receipt
  email, GST invoice, push, credit balance; `qr_url` is null until QR images are served.
- B6 (2026-11-23): the worker's `esim.usage` job runs every 15 minutes for eSIMs that are not
  started or active. It asks the provider for usage, updates the eSIM, keeps one cumulative
  snapshot per UTC day (`/v1/esims/:iccid/usage/daily` turns these into data used per day for the
  last 7 days) and sends notices: eSIM ready (after provisioning), low data (the app's own rule:
  15% or 512 MB left), data used up, 24 hours left (plans of 3+ days) and 2 hours left. Each notice
  goes out once per eSIM (`esim_notice`), in each device's language. Pushes go straight to APNs
  (token auth) and FCM HTTP v1; `PUSH_ROUTE=console` logs them instead. Tokens the services reject
  are deleted.
- Live Activities now start with `pushType: .token`; the app posts each token to
  `/v1/esims/:iccid/live-activity` and the worker sends `update` pushes when usage changes and an
  `end` push when the eSIM expires or runs out. Content-state dates are seconds since 2001, because
  ActivityKit decodes with the default `Date` strategy. Labels are written on the server in the
  activity's language.
- The app registers its device token after sign-in if notifications are already allowed, asks for
  permission on the Success screen after a purchase, re-registers when the language changes and
  removes the token on sign-out. Tapping a notice opens that eSIM's Usage screen.
- `MOCK_USAGE_SPEED` speeds up the mock provider's clock for staging QA. Expiry warnings use real
  time, so with a high speed they fire almost at once.
- B7 (2026-11-23): top-up packs come from the provider with each plan and sync with the catalog
  (`top_up_pack`, `top_up_price`). `POST /v1/esims/:iccid/top-ups` creates a `top_up` order that is
  paid exactly like an eSIM order; the worker calls the provider's top-up with the order ID as its
  idempotency key, then adds the data (and any extra days) to the same eSIM in one transaction,
  brings a used-up eSIM back to active and clears its low-data, used-up and expiry notices so they
  can fire again. Top-ups are offered for eSIMs that are not started, active or used up.
- Referral codes work in the coupon box: ₹150 (7 AED / 7 SAR) off a friend's first eSIM, never
  your own code, and only if they weren't referred by someone else. Paying sets the friend's
  `referred_by`. The referrer gets ₹150 credit (in their profile currency) when that eSIM first
  connects, once per order. A real coupon with the same code wins over a referral code.
- Travel credit lives in the append-only `credit_ledger`. It is applied automatically at checkout
  for eSIMs and top-ups (`priceBreakdown(price, coupon, credit)`, GST on what is left), spent when
  the order is paid and given back if the order is refunded. Credit that covers the whole price
  skips the payment step. Two orders placed at the same moment can both use the same credit; the
  balance never shows below zero, and the gap is small enough to leave for now.
- B8 (2026-11-23): a GST invoice is issued when an INR order (eSIM or top-up) is fulfilled. Numbers
  run per Indian financial year in IST (`VL/2026-27/000001`) from a counter row updated in the same
  transaction. The invoice stores a fixed snapshot (seller, buyer, amounts, CGST/SGST split) and the
  PDF is drawn from it on request with pdfkit, so it never changes after issue. Until we collect
  the buyer's state, place of supply is the seller's state, so tax is CGST 9% + SGST 9%; the
  accountant should confirm this, and the SAC (`INVOICE_SAC`, default `9984`). Customers get a
  15-minute signed link from `GET /v1/orders/:id/invoice` (app Success screen, website success
  page). Production refuses to start without `SELLER_GSTIN`, `SELLER_ADDRESS` and `SELLER_STATE`.
  No PDFs are stored and no credit notes are issued yet.
- Staff: `profile.role` is `customer`, `support` or `admin`; set it with
  `node dist/grant-role.js <phone or email> <role>` on the server. `/v1/admin/*` lets support search
  orders and see payments, eSIM, invoice and staff history; admins can also refund (full refund plus
  any credit used), create and end coupons, and grant goodwill credit. Every staff action is written
  to `audit_log`. The website has `/admin` (orders, order detail, coupons), English only and not
  indexed; it uses the same sign-in as the account page.
- Support: the app's chat now talks to `/v1/support/messages`. With `CHATWOOT_URL` and
  `CHATWOOT_INBOX_IDENTIFIER` set, the server uses Chatwoot's public inbox API with one contact (HMAC
  identity check when `CHATWOOT_HMAC_TOKEN` is set) and one conversation per traveller, and the app
  polls every 5 seconds. Without Chatwoot, messages are stored in `support_message` so the screen
  works on staging, but nobody can reply to them.
