import { flagEmoji } from '@vela/utils';
import { Text, View } from 'react-native';
import { cn } from '@/lib/cn';

export type FlagSize = 'sm' | 'md' | 'lg' | 'xl';

const frame: Record<FlagSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
};

const glyph: Record<FlagSize, string> = {
  sm: 'text-[24px] leading-[28px]',
  md: 'text-[34px] leading-[40px]',
  lg: 'text-[48px] leading-[56px]',
  xl: 'text-[68px] leading-[78px]',
};

export type FlagProps = {
  code: string;
  size?: FlagSize;
  className?: string;
};

export function Flag({ code, size = 'md', className }: FlagProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('items-center justify-center overflow-hidden rounded-pill border border-line bg-surface-3', frame[size], className)}
    >
      <Text allowFontScaling={false} className={glyph[size]}>
        {flagEmoji(code)}
      </Text>
    </View>
  );
}

export type FlagStackProps = {
  codes: readonly string[];
  size?: FlagSize;
  max?: number;
};

export function FlagStack({ codes, size = 'md', max = 3 }: FlagStackProps) {
  return (
    <View className="flex-row">
      {codes.slice(0, max).map((code, index) => (
        <Flag key={code} code={code} size={size} className={cn('border-2 border-surface-1', index > 0 && '-ms-2.5')} />
      ))}
    </View>
  );
}
