# Motion QA checklist

Run on a real iPhone (and one Android phone) in a dev build. Check each row twice: once normally,
once with **Settings › Accessibility › Motion › Reduce Motion** on.

All timings live in `packages/tokens/src/motion.ts`. Easing is `cubic-bezier(0.22, 1, 0.36, 1)`;
springs are response 0.45, damping 0.85 (`velaSpring`).

| # | Animation | Where to see it | Spec | Haptic | Reduce Motion | ✓ |
|---|---|---|---|---|---|---|
| 1 | Splash: sail → signal → name | Cold launch; Profile › Components › Replay | Sail sweeps 0–520 ms, signal 380–1000 ms, name fades up 900–1400 ms while the mark slides into the lockup, hold 250 ms, fade out 320 ms | – | Mark and name fade in over 400 ms | |
| 2 | Section fade-rise | Home on first load | Each section rises 12 pt and fades in, 80 ms apart, 450 ms | – | Plain fade | |
| 3 | Parallax hero | Destination page, scroll up and pull down | Hero moves at 0.35× scroll, fades out by 80% of its height, stretches up to 1.5× on overscroll | – | Fade only | |
| 4 | Card press | Any card, button, chip | Scale 0.98 (icon buttons 0.94, chips 0.96) in 100 ms, spring back; border brightens 7% → 16% | Light tap | No scale, border only | |
| 5 | Offers momentum snap | Home › Offers | Snaps card by card (280 pt + 12 pt gap); light sweep crosses each card every ~4.6 s | Selection tick on snap | No sweep | |
| 6 | Usage ring draw + count-up | Home card, Usage detail | Ring draws 0 → value in 900 ms; number counts up in step | – | Drawn instantly | |
| 7 | Zoom into destination | Home › Explore tile, Explore rows, Global card | iOS 18 native zoom from the tile into the hero flag | Light tap | System handles it | |
| 8 | Plan select glow / dim | Destination › Plans | Selected: border white, surface lifts, soft glow (iOS); others dim to 50% over 280 ms | Selection | Fades only | |
| 9 | Swipe to pay → check | Checkout, Top-up | Thumb follows finger; past 85% (or a flick > 1200 pt/s) it locks, spinner, then check | Tick at 85%, medium on complete, success on paid | Thumb snaps without spring | |
| 10 | Processing loop | After paying | Mark builds and fades on a 1.7 s loop; steps tick every 900 ms | – | Slow opacity pulse | |
| 11 | Success: build → ripple → QR flip | After processing | Gold mark builds (1 s), three gold rings ripple out 160 ms apart (800 ms), QR card flips 180° (700 ms spring) | Success | Fade from mark to QR, no ripple | |
| 12 | Price odometer | Destination price bar (change plan), Checkout total (apply `GULF20`) | Each digit rolls to its new value on the spring | – | Digits swap instantly | |
| 13 | Low-data amber pulse | Profile › Developer › Data scenario › Low data | Ring glows amber, 0.0 ↔ 0.75 opacity, 900 ms each way | – | No pulse | |
| 14 | Countdown crossfade | Usage detail pill | Each changing digit crossfades in 220 ms | – | Same (fade) | |
| 15 | Copy → Copied | Success manual codes, Rewards code, Usage ICCID | Button swaps to "Copied" with a check for 1.2 s | Success | Same | |
| 16 | Tab underline glide | Explore › Countries / Regions / Global | Underline springs to the new tab | Selection | 180 ms slide | |
| 17 | Pull to refresh with the mark | Home, pull down | Gold sail and signal sweep in with the pull over 80 pt; on release the mark loops until done | Tick at full pull, medium on release, success when done | Mark follows the finger, no loop motion | |
| 18 | Sheets | Checkout, Top-up | Native form sheet, 28 pt corners, grabber, 85% then full | – | System | |
| 19 | Toast | Copy, top-up done, coupon | Drops from the top in 280 ms, clears after 1.2 s | Matches tone | Fade | |
| 20 | OTP error shake | Sign in, code `000000` | 5-step shake, 50 ms steps, 8 pt | Error | No shake, red borders only | |
| 21 | Skeleton shimmer | Any loading state (Data scenario › Loading) | Highlight band sweeps every 1.2 s, right-to-left in Arabic | – | Slow fade pulse | |
| 22 | Tab bar | Scroll down on any tab (iOS 26) | Native tab bar minimises on scroll down | System | System | |

## Known gaps

- **Sheet background scale 0.92.** iOS form sheets do not let apps scale the screen behind them;
  only page sheets do that, and they don't support custom detents. Left as the native look.
- **Glow on Android.** The plan-card glow uses an iOS shadow. Android shows the border and lift only.
- **Zoom transition** is iOS 18+. Older iOS and Android use the normal push.
