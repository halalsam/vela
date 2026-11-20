# Landed — Travel eSIM · design handoff

Exported from the Claude Design canvas. Light + dark, English + Arabic (RTL), iPhone 16 Pro (402 × 874 pt).

## What's inside

| Folder | Contents |
|---|---|
| `tokens.json` | Colours (light/dark), type scale, spacing, radii, sizes, springs — **start here** |
| `design-system/` | Typography, Color, Layout & materials, Components (light + dark) |
| `components/` | Shared Status bar and Liquid Glass Tab bar |
| `screens/` | 13 app screens (see map below) |
| `boards/` | Wireframes, dark-mode row, states row, RTL row, `canvas.json` (board layout) |

Each `.dc.html` file is a design source: plain HTML with inline styles for layout, plus a
`<script data-dc-script>` block whose `renderVals()` holds the theme tokens, sample data and
interaction logic (plan selection, swipe actions, OTP, install steps). Read them as a spec —
they need the Claude Design runtime to render, so they won't open standalone in a browser.

## Screen props

| Screen | Props |
|---|---|
| Onboarding | `dark`, `step` 1–3 |
| SignIn | `dark`, `view` choose / phone |
| Home | `dark`, `rtl`, `state` default / loading / lowData / offline |
| Store | `dark` |
| Country | `dark`, `rtl` |
| Checkout | `dark`, `state` default / error |
| Success | `dark` |
| Install | `dark`, `step` 1–4 |
| MyEsims | `dark`, `state` default / empty, `swiped` |
| Usage | `dark`, `state` default / expired |
| TopUp, Profile, Support | `dark` |

## Flow

Onboarding → SignIn → Home → Store → Country → Checkout → Success → Install → MyEsims → Usage → TopUp.
Tab bar: Home · Store · My eSIMs · Profile. Profile → Support.

## Rules

- Monochrome brand: primary = black (light) / white (dark). Hue only for semantic green/orange/red, flags, photos.
- Liquid Glass only on chrome (tab bar, nav, sheets, floating buttons) — never content.
- SF Pro Rounded + tabular figures for GB, prices, countdowns.
- Min tap target 44 pt. Use leading/trailing, mirror directional icons in RTL.

## Placeholders

Prices, plans, networks, QR pattern, `[ORDER-ID]`, `[SMDP.EXAMPLE.COM]`, `[ACTIVATION-CODE]`, `[EMAIL]`,
iOS Settings screenshots, brand name "Landed". Sign in with Apple and Apple Pay must use Apple's official buttons.

## Prompt for Claude Code

```
Build the "Landed" travel eSIM iPhone app from this design handoff folder.
Read README.md and tokens.json first, then design-system/, components/, screens/.

Tech stack: [YOUR STACK HERE]

Build order: tokens + theme (light/dark, RTL) → shared components → screens in flow order with
mock data → states → real APIs. Match spacing, radii, type and colours exactly. Keep components modular.
```
