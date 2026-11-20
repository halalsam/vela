# vela

Travel eSIM app (iOS + Android) and website. land connected.

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 58, Expo Router, NativeWind |
| `apps/web` | Next.js 16 App Router, Tailwind |
| `packages/tokens` | Colours, type scale, spacing, radii, motion + the shared Tailwind preset |
| `packages/brand` | Logo masters, fonts, `<VelaSymbol />`, `<VelaWordmark />`, `<VelaLockup />` |
| `design/` | Claude Design export (layouts and flows reference) |
| `docs/decisions.md` | Product and design decisions |
| `docs/motion-qa.md` | Device checklist for every animation and haptic |

## Commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm brand:assets
```

`pnpm brand:assets` regenerates logo geometry, app icons, splash, favicons, the OG image and web
fonts from `packages/brand/logo`.

## Running the app

Dev builds only. Expo Go will not work.

```bash
cd apps/mobile
npx eas-cli@latest build --profile development-simulator --platform ios
pnpm dev
```

On a Mac with Xcode you can build locally instead with `pnpm ios`. Android works on Linux with
`pnpm android`.
