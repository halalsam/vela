# Vela logo system 1.0

The idea: Vela is the sail of the ship Argo in the southern sky. The symbol is one 60° sextant of that sky. Its inner sector is a sail, and its outer band is an arriving signal. Land connected.

## Files

| Folder | What's in it |
|---|---|
| `logo/` | Masters as SVG: symbol, symbol-small, wordmark, horizontal and stacked, each in `-black` (#0A0A0A) and `-white` (#FFFFFF). Symbol, horizontal and stacked also come in `-gold` (Champagne). |
| `logo/png/` | Every master as a transparent PNG, fitted to 2000 px. |
| `icons/ios/` | 1024 px icons. `light` is the default (white on matte black). `dark` has a transparent background with a Champagne symbol, and `dark-preview` shows it on black. `tinted` is the greyscale source. `alt-ivory` is an optional alternate icon. |
| `icons/android/` | Adaptive icon layers at 432 px (108 dp @4x): foreground, background and monochrome. Also `ic_launcher.xml`, `colors.xml` and a 512 px Play Store icon. |
| `icons/web/` | `favicon.ico` (16/32/48) and `favicon.svg` (switches to white in dark mode). Also apple-touch-icon, icon-192/512, maskable-512, `site.webmanifest` and `head-snippet.html`. |
| `mockups/` | Home screen (light and dark), splash with launch beats, Dynamic Island, eSIM boarding pass, and tote with leather tag. |
| `guide/` | One-page brand guide as PNG, PDF and HTML. Also the construction diagrams for the symbol and the lockup. |

## Rules in short

- **Grid:** u = 8 px at master size.
  - Symbol: sail r 12u, gap 4u, band 16u–22u. One 60° sextant with the mast vertical.
  - Lockup: caps are 12u tall (the sail height) and centred on the symbol. The gap is 6u and stems are 2u. Horizontal bars are 15/16 of a stem, and the V and Λ points overshoot by 3/96.
  - Stacked: the wordmark is at 2/3 size, 5u below the symbol, on one centre axis.
- **Clear space:** X = the band width (6u). Keep at least X clear on every side, and 2X when there is room.
- **Minimum size:**

  | Version | Screen | Print |
  |---|---|---|
  | Symbol | 16 px | 5 mm |
  | Horizontal | 140 px wide | 30 mm |
  | Stacked | 96 px wide | 20 mm |
  | Wordmark | 80 px wide | 18 mm |

  Use `symbol-small` at 32 px / 10 mm and below. It has a heavier band and a wider gap.
- **Colour:**

  | Colour | HEX | Use |
  |---|---|---|
  | Matte Black | #0A0A0A | Main background, about 70% of a layout |
  | Ivory | #F5F3EF | Second background, about 25% |
  | Champagne (recommended accent) | #C8B285 | About 5%. 9.6:1 contrast on black. |
  | Champagne Deep | #7D6838 | For accent text on ivory, 4.9:1 |
  | Star Blue (not recommended) | #9DB2CC | Alternative accent only |

  The core logo is always one colour, with no gradients.
- **Type:** the wordmark is custom-drawn artwork, so never set it in a font. Use Manrope (OFL) for UI and text.

## Test results

- Audit: 99–100/100 for every master. The only note is a fractional viewBox, which comes from the exact 60° geometry and is intentional.
- No live text, rasters, filters, strokes or transforms in any master.
- The symbol was checked at 16 px, reversed, in one colour, blurred, mirrored and on photo backgrounds.

## Open items

- **Trademark:** this is not a clearance. Run a professional trademark search for VELA in classes 9 and 38 in India, the UAE and KSA, plus a reverse image search on the symbol.
- **Known risk:** at very small sizes the symbol sits near wifi/RSS territory. This is partly the point (sail × signal). Never rotate it, because tilted it reads as wifi.
- **Pantone:** the Pantone values are nearest matches. Proof them on a physical swatch book before print.
- **iOS 26:** for Liquid Glass icons, import `logo/vela-symbol-white.svg` into Icon Composer as the foreground layer on a #0A0A0A background.
