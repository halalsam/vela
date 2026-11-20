import { BlurMask, Canvas, Circle, Path } from '@shopify/react-native-skia';
import { colors, durations } from '@vela/tokens';
import { dataParts, formatData, isLowData, remainingFraction } from '@vela/utils';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import {
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/ui';
import { useCountUp } from '@/hooks/useCountUp';
import { useRingDraw } from '@/hooks/useRingDraw';
import { cn } from '@/lib/cn';

export type UsageRingSize = 'sm' | 'md' | 'lg';
export type UsageRingState = 'active' | 'low' | 'expired' | 'pending';

const spec: Record<UsageRingSize, { px: number; stroke: number; frame: string }> = {
  sm: { px: 32, stroke: 4, frame: 'h-8 w-8' },
  md: { px: 112, stroke: 10, frame: 'h-28 w-28' },
  lg: { px: 200, stroke: 16, frame: 'h-[200px] w-[200px]' },
};

const strokeColor: Record<UsageRingState, string> = {
  active: colors.accent.DEFAULT,
  low: colors.warning.DEFAULT,
  expired: colors.danger.DEFAULT,
  pending: colors.fg.quaternary,
};

export type UsageRingProps = {
  usedMb: number;
  totalMb: number;
  size?: UsageRingSize;
  state?: UsageRingState;
  showCenter?: boolean;
  className?: string;
};

export function ringStateFor(usedMb: number, totalMb: number, status: 'active' | 'expired' | 'not_started' | 'depleted'): UsageRingState {
  if (status === 'not_started') return 'pending';
  if (status === 'expired' || status === 'depleted') return 'expired';
  return isLowData(usedMb, totalMb) ? 'low' : 'active';
}

export function UsageRing({ usedMb, totalMb, size = 'md', state, showCenter = size !== 'sm', className }: UsageRingProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const ringState = state ?? (isLowData(usedMb, totalMb) ? 'low' : 'active');
  const fraction = ringState === 'expired' ? 0 : ringState === 'pending' ? 1 : remainingFraction(usedMb, totalMb);
  const progress = useRingDraw(fraction);
  const remaining = Math.max(0, totalMb - usedMb);
  const parts = dataParts(ringState === 'pending' ? totalMb : remaining);
  const shown = useCountUp(Number(parts.value), { decimals: parts.value.includes('.') ? 1 : 0 });
  const pulse = useSharedValue(0.2);
  const { px, stroke, frame } = spec[size];
  const radius = (px - stroke) / 2;
  const center = px / 2;
  const top = stroke / 2;
  const arc = `M ${center} ${top} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${top}`;

  useEffect(() => {
    if (ringState !== 'low' || reduceMotion) {
      cancelAnimation(pulse);
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withTiming(0.75, { duration: durations.slow * 2 }), -1, true));
    return () => cancelAnimation(pulse);
  }, [ringState, reduceMotion, pulse]);

  const glowOpacity = useDerivedValue(() => (ringState === 'low' ? pulse.get() : 0));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('esim.ringLabel', { left: formatData(remaining), total: formatData(totalMb) })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      className={cn('items-center justify-center', frame, className)}
    >
      <Canvas className="absolute inset-0">
        <Circle cx={center} cy={center} r={radius} style="stroke" strokeWidth={stroke} color={colors.surface[3]} />
        {ringState === 'low' ? (
          <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round" color={colors.warning.DEFAULT} start={0} end={progress} opacity={glowOpacity}>
            <BlurMask blur={stroke} style="normal" />
          </Path>
        ) : null}
        <Path
          path={arc}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={strokeColor[ringState]}
          start={0}
          end={progress}
          opacity={ringState === 'pending' ? 0.6 : 1}
        />
      </Canvas>
      {showCenter ? (
        <View className="items-center">
          <Text variant={size === 'lg' ? 'data-lg' : 'data-sm'} tone={ringState === 'expired' ? 'danger' : ringState === 'low' ? 'warning' : 'primary'}>
            {ringState === 'expired' ? '0' : shown}
            <Text variant={size === 'lg' ? 'body' : 'caption'} tone="secondary">
              {` ${parts.unit}`}
            </Text>
          </Text>
          <Text variant="caption" tone="tertiary">
            {ringState === 'pending' ? t('esim.statusNotStarted') : t('esim.ofTotal', { total: formatData(totalMb) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
