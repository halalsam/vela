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
