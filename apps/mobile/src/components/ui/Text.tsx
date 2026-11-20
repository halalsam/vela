import type { TypeToken } from '@vela/tokens';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useDirection } from '@/i18n/useDirection';
import { cn } from '@/lib/cn';
import { toneTextClass, type Tone } from './tone';

export type TextWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold';

type VariantSpec = {
  weight: TextWeight | 'display';
  latin: string;
  arabic: string;
  digits?: boolean;
  capped?: boolean;
};

const variants: Record<TypeToken, VariantSpec> = {
  'display-xl': { weight: 'display', latin: 'text-display-xl lowercase', arabic: 'text-display-xl-ar', capped: true },
  'display-lg': { weight: 'display', latin: 'text-display-lg lowercase', arabic: 'text-display-lg-ar', capped: true },
  'display-md': { weight: 'display', latin: 'text-display-md lowercase', arabic: 'text-display-md-ar', capped: true },
  title: { weight: 'semibold', latin: 'text-title', arabic: 'text-title-ar' },
  body: { weight: 'regular', latin: 'text-body', arabic: 'text-body-ar' },
  callout: { weight: 'regular', latin: 'text-callout', arabic: 'text-callout-ar' },
  caption: { weight: 'regular', latin: 'text-caption', arabic: 'text-caption-ar' },
  label: { weight: 'semibold', latin: 'text-label uppercase', arabic: 'text-label-ar' },
  'label-sm': { weight: 'semibold', latin: 'text-label-sm uppercase', arabic: 'text-label-sm-ar' },
  'data-xl': { weight: 'light', latin: 'text-data-xl tabular-nums', arabic: 'text-data-xl tabular-nums', digits: true, capped: true },
  'data-lg': { weight: 'light', latin: 'text-data-lg tabular-nums', arabic: 'text-data-lg tabular-nums', digits: true, capped: true },
  'data-md': { weight: 'medium', latin: 'text-data-md tabular-nums', arabic: 'text-data-md tabular-nums', digits: true, capped: true },
  'data-sm': { weight: 'medium', latin: 'text-data-sm tabular-nums', arabic: 'text-data-sm tabular-nums', digits: true },
};

const latinFamily: Record<TextWeight | 'display', string> = {
  display: 'font-display',
  light: 'font-sans-light',
  regular: 'font-sans',
  medium: 'font-sans-medium',
  semibold: 'font-sans-semibold',
  bold: 'font-sans-bold',
};

const arabicFamily: Record<TextWeight | 'display', string> = {
  display: 'font-arabic-light',
  light: 'font-arabic-light',
  regular: 'font-arabic',
  medium: 'font-arabic-medium',
  semibold: 'font-arabic-semibold',
  bold: 'font-arabic-bold',
};

export type TextProps = Omit<RNTextProps, 'style'> & {
  variant?: TypeToken;
  tone?: Tone;
  weight?: TextWeight;
  align?: 'auto' | 'center';
  className?: string;
};

export function Text({ variant = 'body', tone = 'primary', weight, align = 'auto', className, ...rest }: TextProps) {
  const { isRTL } = useDirection();
  const spec = variants[variant];
  const useArabic = isRTL && !spec.digits;
  const resolvedWeight = spec.weight === 'display' ? 'display' : (weight ?? spec.weight);
  const family = useArabic ? arabicFamily[resolvedWeight] : latinFamily[resolvedWeight];
  return (
    <RNText
      maxFontSizeMultiplier={spec.capped ? 1.3 : undefined}
      className={cn(
        family,
        useArabic ? spec.arabic : spec.latin,
        toneTextClass[tone],
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    />
  );
}
