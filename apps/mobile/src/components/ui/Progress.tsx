import { colors, durations } from '@vela/tokens';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@/lib/cn';
import { timing, velaSpring } from '@/lib/motion';
import { Text } from './Text';

const DOT = 6;
const DOT_ACTIVE = 20;

function Dot({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const target = active ? 1 : 0;
    progress.set(reduceMotion ? withTiming(target, timing(durations.fast)) : withSpring(target, velaSpring));
  }, [active, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    height: 6,
    borderRadius: 999,
    width: interpolate(progress.get(), [0, 1], [DOT, DOT_ACTIVE]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.fg.quaternary, colors.fg.DEFAULT]),
  }));

  return <Animated.View style={style} />;
}

export type PageDotsProps = {
  count: number;
  index: number;
  className?: string;
};

export function PageDots({ count, index, className }: PageDotsProps) {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('ui.pageOf', { current: index + 1, total: count })}
      className={cn('flex-row items-center gap-1.5 self-center', className)}
    >
      {Array.from({ length: count }, (_, dot) => (
        <Dot key={dot} active={dot === index} />
      ))}
    </View>
  );
}

export type StepBarProps = {
  total: number;
  current: number;
  showLabel?: boolean;
  className?: string;
};

export function StepBar({ total, current, showLabel = true, className }: StepBarProps) {
  const { t } = useTranslation();
  const label = t('ui.stepOf', { current, total });
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} className={cn('flex-row items-center gap-3', className)}>
      <View className="flex-1 flex-row gap-1.5">
        {Array.from({ length: total }, (_, step) => (
          <View key={step} className={cn('h-1 flex-1 rounded-pill', step < current ? 'bg-fg' : 'bg-surface-3')} />
        ))}
      </View>
      {showLabel ? (
        <Text variant="caption" tone="tertiary" className="tabular-nums">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
