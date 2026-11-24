import { flagEmoji } from '@vela/utils';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { flagAsset } from '@/lib/geoAssets';
import { cn } from '@/lib/cn';

export type FlagSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

// Exact points, not Tailwind h-/w- steps: NativeWind's native rem is 14, so
// `h-28` is 98pt, not 112pt.
const points: Record<FlagSize, number> = {
  sm: 20,
  md: 28,
  lg: 40,
  xl: 52,
  hero: 112,
};

export type FlagProps = {
  code: string;
  size?: FlagSize;
  className?: string;
};

export function Flag({ code, size = 'md', className }: FlagProps) {
  const px = points[size];
  const source = flagAsset(code);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: px, height: px }}
      className={cn('items-center justify-center overflow-hidden rounded-pill bg-surface-3', className)}
    >
      {source ? (
        <Image source={source} style={{ width: px, height: px }} contentFit="cover" transition={0} />
      ) : (
        <Text allowFontScaling={false} style={{ fontSize: px * 1.2, lineHeight: px * 1.4 }}>
          {flagEmoji(code)}
        </Text>
      )}
      {/* Hairline ring so white-edged flags (Japan, Indonesia) don't melt into light surfaces. */}
      <View pointerEvents="none" className="absolute inset-0 rounded-pill border border-line-strong" />
    </View>
  );
}

export type FlagStackProps = {
  codes: readonly string[];
  size?: FlagSize;
  max?: number;
};

export function FlagStack({ codes, size = 'md', max = 3 }: FlagStackProps) {
  const overlap = Math.round(points[size] * 0.3);
  return (
    <View className="flex-row">
      {codes.slice(0, max).map((code, index) => (
        <View key={code} style={index > 0 ? { marginStart: -overlap } : undefined} className="rounded-pill border-2 border-surface-1">
          <Flag code={code} size={size} />
        </View>
      ))}
    </View>
  );
}
