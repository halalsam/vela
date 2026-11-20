import type { Config } from 'tailwindcss';
import { colors } from './colors';
import { arabicLineHeightOffset, fontFamilies, typeScale } from './typography';
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

type FontSizeEntry = [string, { lineHeight: string; letterSpacing?: string }];

const latinSizes = Object.entries(typeScale).map(([name, style]): [string, FontSizeEntry] => {
  const meta: FontSizeEntry[1] = { lineHeight: px(style.lineHeight) };
  if ('letterSpacing' in style) meta.letterSpacing = px(style.letterSpacing);
  return [name, [px(style.fontSize), meta]];
});

const arabicSizes = Object.entries(typeScale).map(([name, style]): [string, FontSizeEntry] => [
  `${name}-ar`,
  [px(style.fontSize), { lineHeight: px(style.lineHeight + arabicLineHeightOffset), letterSpacing: '0px' }],
]);

const fontSize: Record<string, FontSizeEntry | string> = {
  ...Object.fromEntries([...latinSizes, ...arabicSizes]),
  field: px(16),
};

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
