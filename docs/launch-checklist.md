# Launch checklist

Everything that has to be true before vela takes real money. Work top to bottom: later sections depend
on earlier ones. Settings named in `code` go in `infra/env/production.env` on the server (secrets in
`production.secrets`), or in the app and website build settings where noted.

## 1. Business and legal

- [ ] Decide the legal entity. A private limited company is the safe choice: DoT and Apple's
      organisation account both expect one.
- [ ] Ask a telecom lawyer whether selling foreign eSIMs to Indian travellers needs the DoT NOC for
      international roaming SIM cards, and apply if it does.
- [ ] Check your employment contract for conflict-of-interest, non-compete and IP clauses before
      launching.
- [ ] Register for GST and get the GSTIN.
- [ ] Ask the accountant to confirm:
  - [ ] GST on eSIMs sold to Indian residents for use abroad, the place of supply, and the SAC code
        (`INVOICE_SAC`, default `9984`).
  - [ ] Whether sales to foreign customers are exports (zero-rated under a LUT). The app charges GST
        on rupee sales only.
  - [ ] What the UAE and Saudi customers' VAT position is.
- [ ] Have a lawyer review the privacy policy and terms (`apps/web/src/lib/legal.ts`), especially:
  - [ ] the 30-day refund window for eSIMs that were never installed;
  - [ ] the governing city;
  - [ ] whether you need an EU representative under the GDPR.
- [ ] Appoint a grievance officer and set up a support mailbox.

## 2. Accounts and keys

| Service | What to get | Settings |
|---|---|---|
| eSIM Access | Account, wallet top-up, access code | `ESIM_PROVIDER=esimaccess`, `ESIM_ACCESS_CODE` |
| eSIM Go (backup) | Account, wallet top-up, API key | `ESIM_BACKUP_PROVIDER=esimgo`, `ESIM_GO_API_KEY` |
| Razorpay | Live mode, International Payments, Apple Pay domain verification, automatic capture, webhook to `/v1/webhooks/razorpay` (`payment.captured`, `payment.failed`, `refund.processed`) | `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Apple Developer (organisation) | Team ID, App ID `com.vela.app`, App Group, Sign in with Apple, Services ID for the website, APNs key (.p8) | `APPLE_SERVICE_ID`, `APPLE_CLIENT_SECRET`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_ENV=production`; `ios.appleTeamId` in `app.config.ts` |
| Google Cloud | OAuth client IDs (web and iOS) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_IOS_CLIENT_ID` |
| Firebase | Project, Android app, service account | `FCM_SERVICE_ACCOUNT`; `GOOGLE_SERVICES_JSON` for the Android build |
| MSG91 | Account, DLT-approved OTP template | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` |
| Twilio | Account, sending number | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Chatwoot | API inbox (HMAC identity on) | `CHATWOOT_URL`, `CHATWOOT_INBOX_IDENTIFIER`, `CHATWOOT_HMAC_TOKEN` |
| Resend | Verified sending domain, API key | `EMAIL_ROUTE=live`, `RESEND_API_KEY`, `EMAIL_FROM` |
| eSIM Access webhooks | Webhook URL `/v1/webhooks/esimaccess?token=…` set in their developer console | `ESIM_ACCESS_WEBHOOK_TOKEN`, `ESIM_ACCESS_WEBHOOK_IP_CHECK=true` |
| Sentry | Project | `SENTRY_DSN` |
| Cloudflare R2 or Backblaze B2 | Bucket and access key for backups | `BACKUP_S3_BUCKET`, `RCLONE_CONFIG_S3_*`, `BACKUP_AGE_RECIPIENT` |

Generate `ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` with `openssl rand -hex 32`. Store every key in a
password manager, never in git.

## 3. Server and domains

- [ ] VPS set up as in `infra/README.md`, with Caddy serving the API over HTTPS.
- [ ] Domains: the website, `api.` for the API. Set `API_PUBLIC_URL`, `CORS_ORIGINS` (the website
      origin), `COOKIE_DOMAIN` (the shared parent domain), `NEXT_PUBLIC_SITE_URL`,
      `NEXT_PUBLIC_API_URL` and `VELA_API_URL` for the website, and `EXPO_PUBLIC_API_URL` and
      `EXPO_PUBLIC_SITE_URL` for the app.
- [ ] Seller details: `SELLER_NAME`, `SELLER_GSTIN`, `SELLER_ADDRESS`, `SELLER_STATE`.
- [ ] Legal page details for the website: `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_ADDRESS`,
      `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_OFFICER`, `NEXT_PUBLIC_GRIEVANCE_EMAIL`,
      `NEXT_PUBLIC_GOVERNING_CITY`.
- [ ] `APP_ENV=production`, `SMS_ROUTE=live`, `PUSH_ROUTE=live`. The server refuses to start in
      production while payments, SMS, eSIMs or seller details are still on test settings.
- [ ] Margin: check `PRICING_MARGIN_PERCENT` (default 40) against competitors' prices.
- [ ] Backups: generate the age key, keep the private key offline, deploy, and confirm the first
      "backup uploaded" log line and a healthy `backup` container.
- [ ] Restore drill: restore last night's backup from the bucket into a new database with the
      private key, as in `infra/README.md`. Repeat every three months.
- [ ] Make yourself admin: sign in once, then run `node dist/grant-role.js <your phone> admin`.

## 4. Apps

- [ ] App Store: build with EAS, privacy policy URL (`/en/privacy`), App Privacy answers matching
      the privacy policy, account deletion (Profile › Delete account) noted for review, screenshots in
      English and Arabic.
- [ ] Google Play: data safety form, privacy policy URL, signed build with `GOOGLE_SERVICES_JSON`.
- [ ] Register the App Group for both bundle IDs (`com.vela.app`, `com.vela.app.VelaWidgets`).

## 5. Test with real money, on real phones

Use one or two cheap plans and refund them afterwards.

- [ ] Sign in with Apple, Google and a phone code (an Indian and a non-Indian number).
- [ ] Buy with UPI, an Indian card and an international card, and with Apple Pay on the website.
- [ ] Pay in EUR and AED; check that no GST is charged and that the invoice rules match the accountant.
- [ ] Install the eSIM from the app and from the QR on another phone; check it connects abroad or
      with a test SIM from the destination.
- [ ] Usage, low-data and expiry notifications; Live Activity updates with the app closed.
- [ ] Top-up adds data to the same eSIM.
- [ ] Referral code from a second account; credit appears when the friend's eSIM connects.
- [ ] Download the GST invoice; check it with the accountant.
- [ ] Failure path: switch eSIM Access off (empty wallet) and confirm the order is filled by eSIM Go;
      switch both off and confirm the customer is refunded automatically.
- [ ] Support chat reply from the Chatwoot dashboard reaches the app.
- [ ] Admin: search, refund, coupon, goodwill credit; every action appears in the audit log.

## 6. Soft launch

- [ ] Friends-and-family week: 20 to 50 people, invite-only, with a coupon.
- [ ] Watch daily: Sentry errors, failed orders in `/admin`, supplier balances, Razorpay settlements,
      support conversations.
- [ ] Keep enough balance in both supplier wallets for a busy week, and set low-balance alerts in
      each portal.
- [ ] Rollback plan: redeploy the previous image tag with `infra/deploy.sh production <tag>`;
      database changes only ever add columns, so the previous image still runs.
- [ ] Then open to everyone, starting with India and the UAE.

## Later

- Gulf local payment methods (mada, KNET) need a Gulf company and Tap or Stripe.
- eSIM Go webhooks (eSIM Access webhooks are in place).
- Cancelling eSIM Go eSIMs on refund (only eSIM Access cancels today).
- Storing invoice and credit note PDFs in the bucket instead of drawing them on request.
- Website destination pages rendered per currency instead of swapped in the browser.
