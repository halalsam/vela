export const fontFamilies = {
  // Satoshi and Cabinet Grotesk come from Fontshare (ITF Free Font License).
  // Satoshi ships no SemiBold cut, so semibold maps to Bold.
  sansLight: 'Satoshi-Light',
  sans: 'Satoshi-Regular',
  sansMedium: 'Satoshi-Medium',
  sansSemibold: 'Satoshi-Bold',
  sansBold: 'Satoshi-Bold',
  display: 'CabinetGrotesk-Bold',
  displayMedium: 'CabinetGrotesk-Medium',
  arabicLight: 'IBMPlexSansArabic-Light',
  arabic: 'IBMPlexSansArabic-Regular',
  arabicMedium: 'IBMPlexSansArabic-Medium',
  arabicSemibold: 'IBMPlexSansArabic-SemiBold',
  arabicBold: 'IBMPlexSansArabic-Bold',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  family: FontFamilyToken;
  uppercase?: boolean;
  lowercase?: boolean;
  tabular?: boolean;
};

export const typeScale = {
  'display-xl': { fontSize: 38, lineHeight: 42, letterSpacing: -1.1, family: 'display', lowercase: true },
  'display-lg': { fontSize: 30, lineHeight: 34, letterSpacing: -0.8, family: 'display', lowercase: true },
  'display-md': { fontSize: 24, lineHeight: 28, letterSpacing: -0.5, family: 'display', lowercase: true },
  title: { fontSize: 19, lineHeight: 24, letterSpacing: -0.2, family: 'sansSemibold' },
  body: { fontSize: 16, lineHeight: 22, family: 'sans' },
  callout: { fontSize: 14, lineHeight: 20, family: 'sans' },
  caption: { fontSize: 12, lineHeight: 16, family: 'sans' },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 1.4, family: 'sansSemibold', uppercase: true },
  'label-sm': { fontSize: 10, lineHeight: 12, letterSpacing: 1.2, family: 'sansSemibold', uppercase: true },
  'data-xl': { fontSize: 56, lineHeight: 60, letterSpacing: -1, family: 'sansLight', tabular: true },
  'data-lg': { fontSize: 40, lineHeight: 44, letterSpacing: -0.6, family: 'sansLight', tabular: true },
  'data-md': { fontSize: 28, lineHeight: 32, letterSpacing: -0.3, family: 'sansMedium', tabular: true },
  'data-sm': { fontSize: 20, lineHeight: 24, family: 'sansMedium', tabular: true },
} as const satisfies Record<string, TypeStyle>;

export type TypeToken = keyof typeof typeScale;

export const arabicFamilyFor: Record<FontFamilyToken, FontFamilyToken> = {
  sansLight: 'arabicLight',
  sans: 'arabic',
  sansMedium: 'arabicMedium',
  sansSemibold: 'arabicSemibold',
  sansBold: 'arabicBold',
  display: 'arabicLight',
  displayMedium: 'arabicLight',
  arabicLight: 'arabicLight',
  arabic: 'arabic',
  arabicMedium: 'arabicMedium',
  arabicSemibold: 'arabicSemibold',
  arabicBold: 'arabicBold',
};

export const arabicLineHeightOffset = 4;
