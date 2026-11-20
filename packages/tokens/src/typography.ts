export const fontFamilies = {
  sansLight: 'Manrope-Light',
  sans: 'Manrope-Regular',
  sansMedium: 'Manrope-Medium',
  sansSemibold: 'Manrope-SemiBold',
  sansBold: 'Manrope-Bold',
  display: 'InstrumentSerif-Regular',
  displayItalic: 'InstrumentSerif-Italic',
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
  'display-xl': { fontSize: 40, lineHeight: 44, letterSpacing: -0.4, family: 'display', lowercase: true },
  'display-lg': { fontSize: 32, lineHeight: 36, letterSpacing: -0.3, family: 'display', lowercase: true },
  'display-md': { fontSize: 26, lineHeight: 30, letterSpacing: -0.2, family: 'display', lowercase: true },
  title: { fontSize: 20, lineHeight: 26, family: 'sansSemibold' },
  body: { fontSize: 16, lineHeight: 22, family: 'sans' },
  callout: { fontSize: 14, lineHeight: 20, family: 'sans' },
  caption: { fontSize: 12, lineHeight: 16, family: 'sans' },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 2, family: 'sansSemibold', uppercase: true },
  'label-sm': { fontSize: 10, lineHeight: 12, letterSpacing: 2, family: 'sansSemibold', uppercase: true },
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
  displayItalic: 'arabicLight',
  arabicLight: 'arabicLight',
  arabic: 'arabic',
  arabicMedium: 'arabicMedium',
  arabicSemibold: 'arabicSemibold',
  arabicBold: 'arabicBold',
};

export const arabicLineHeightOffset = 4;
