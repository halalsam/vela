import type { Config } from 'tailwindcss';
import { colors } from './colors';
import { fontFamilies, typeScale } from './typography';
import { radii, sizes, spacing } from './layout';
import { durations, easingCss } from './motion';

const px = (value: number) => `${value}px`;

const webFallback = ['ui-sans-serif', 'system-ui', 'sans-serif'];
const serifFallback = ['ui-serif', 'Georgia', 'serif'];

const fontFamily = {
  'sans-light': [fontFamilies.sansLight, ...webFallback],
  sans: [fontFamilies.sans, ...webFallback],
  'sans-medium': [fontFamilies.sansMedium, ...webFallback],
  'sans-semibold': [fontFamilies.sansSemibold, ...webFallback],
  'sans-bold': [fontFamilies.sansBold, ...webFallback],
  display: [fontFamilies.display, ...serifFallback],
  'display-italic': [fontFamilies.displayItalic, ...serifFallback],
  'arabic-light': [fontFamilies.arabicLight, ...webFallback],
  arabic: [fontFamilies.arabic, ...webFallback],
  'arabic-medium': [fontFamilies.arabicMedium, ...webFallback],
  'arabic-semibold': [fontFamilies.arabicSemibold, ...webFallback],
  'arabic-bold': [fontFamilies.arabicBold, ...webFallback],
};

const fontSize = Object.fromEntries(
  Object.entries(typeScale).map(([name, style]) => {
    const letterSpacing = 'letterSpacing' in style ? px(style.letterSpacing) : undefined;
    return [
      name,
      [px(style.fontSize), letterSpacing ? { lineHeight: px(style.lineHeight), letterSpacing } : { lineHeight: px(style.lineHeight) }],
    ];
  }),
) as Record<string, [string, { lineHeight: string; letterSpacing?: string }]>;

export const velaPreset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily,
      fontSize,
      borderRadius: {
        chip: px(radii.chip),
        button: px(radii.button),
        card: px(radii.card),
        'card-lg': px(radii.cardLg),
        sheet: px(radii.sheet),
        pill: px(radii.pill),
      },
      spacing: {
        gutter: px(spacing.gutter),
        section: px(spacing.section),
        'card-gap': px(spacing.cardGap),
        tap: px(sizes.tapTarget),
        button: px(sizes.buttonHeight),
        'button-compact': px(sizes.buttonHeightCompact),
      },
      minHeight: {
        tap: px(sizes.tapTarget),
      },
      minWidth: {
        tap: px(sizes.tapTarget),
      },
      transitionTimingFunction: {
        vela: easingCss.vela,
      },
      transitionDuration: {
        fast: `${durations.fast}ms`,
        base: `${durations.base}ms`,
        slow: `${durations.slow}ms`,
      },
    },
  },
} satisfies Partial<Config>;

export default velaPreset;
