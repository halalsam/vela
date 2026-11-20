# vela

Travel eSIM app (iOS + Android) and website. land connected.

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 58, Expo Router, NativeWind |
| `apps/web` | Next.js 16 App Router, Tailwind |
| `apps/server` | Hono API + pg-boss worker on Postgres (Drizzle) |
| `infra/` | Docker Compose, Caddy and the deploy script for the VPS |
| `packages/tokens` | Colours, type scale, spacing, radii, motion + the shared Tailwind preset |
| `packages/brand` | Logo masters, fonts, `<VelaSymbol />`, `<VelaWordmark />`, `<VelaLockup />` |
| `design/` | Claude Design export (layouts and flows reference) |
| `docs/decisions.md` | Product and design decisions |
| `docs/motion-qa.md` | Device checklist for every animation and haptic |
| `docs/backend-plan.md` | Backend architecture, data model, API and milestones |

## Commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm brand:assets
```

Server locally (needs a Postgres; copy `apps/server/.env.example` to `.env`):

```bash
cd apps/server
pnpm build && pnpm migrate
pnpm dev
pnpm dev:worker
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
