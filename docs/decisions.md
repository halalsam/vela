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
