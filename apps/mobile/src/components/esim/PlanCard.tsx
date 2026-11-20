import type { Plan } from '@vela/api';
import { colors, durations } from '@vela/tokens';
import { dataParts, formatPrice, pricePerGb } from '@vela/utils';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Pill, Text } from '@/components/ui';
import { usePressScale } from '@/hooks/usePressScale';
import { haptics } from '@/lib/haptics';
import { timing, velaSpring } from '@/lib/motion';

export type PlanCardProps = {
  plan: Plan;
  selected?: boolean;
  dimmed?: boolean;
  bestValue?: boolean;
  onPress?: () => void;
};

export function PlanCard({ plan, selected = false, dimmed = false, bestValue = false, onPress }: PlanCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { onPressIn, onPressOut, animatedStyle: pressStyle } = usePressScale();
  const selection = useSharedValue(selected ? 1 : 0);
  const dim = useSharedValue(dimmed && !selected ? 1 : 0);
  const data = dataParts(plan.data_mb);
  const price = formatPrice(plan.price, plan.currency);
  const perGb = formatPrice(Math.round(pricePerGb(plan)), plan.currency);
  const days = t('esim.days', { count: plan.validity_days });

  useEffect(() => {
    const target = selected ? 1 : 0;
    selection.set(reduceMotion ? withTiming(target, timing(durations.fast)) : withSpring(target, velaSpring));
  }, [selected, reduceMotion, selection]);

  useEffect(() => {
    dim.set(withTiming(dimmed && !selected ? 1 : 0, timing(durations.base)));
  }, [dimmed, selected, dim]);

  const surfaceStyle = useAnimatedStyle(() => {
    const s = selection.get();
    return {
      opacity: interpolate(dim.get(), [0, 1], [1, 0.5]),
      borderColor: interpolateColor(s, [0, 1], [colors.line.DEFAULT, colors.fg.DEFAULT]),
      backgroundColor: interpolateColor(s, [0, 1], [colors.surface[1], colors.surface[2]]),
      shadowOpacity: interpolate(s, [0, 1], [0, 0.22]),
    };
  });

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[`${data.value} ${data.unit}`, days, price, bestValue ? t('esim.bestValue') : null].filter(Boolean).join(', ')}
    >
      <Animated.View style={pressStyle}>
        <Animated.View
          style={surfaceStyle}
          className="min-h-[84px] flex-row items-center gap-4 rounded-card border border-t-line-highlight px-section py-4 shadow-lg shadow-fg"
        >
          <View className="flex-1 gap-1.5">
            <View className="flex-row items-baseline gap-2">
              <Text variant="data-md">
                {data.value}
                <Text variant="body" weight="semibold">{` ${data.unit}`}</Text>
              </Text>
              <Text variant="callout" tone="tertiary">
                {days}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {bestValue ? <Pill label={t('esim.bestValue')} tone="accent" caps size="sm" /> : null}
              {plan.is_5g ? <Pill label={t('esim.fiveG')} size="sm" /> : null}
              {plan.hotspot ? <Pill label={t('esim.hotspot')} size="sm" /> : null}
            </View>
          </View>
          <View className="items-end gap-0.5">
            <Text variant="data-sm">{price}</Text>
            <Text variant="caption" tone="tertiary">
              {t('esim.perGb', { price: perGb })}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
