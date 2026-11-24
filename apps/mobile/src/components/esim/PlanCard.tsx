import type { Plan } from '@vela/api';
import { dataParts, formatPrice, pricePerGb } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon, Pill, Text } from '@/components/ui';
import { usePressScale } from '@/hooks/usePressScale';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

export type PlanCardProps = {
  plan: Plan;
  selected?: boolean;
  /** Kept for API compatibility. Other plans are no longer dimmed: dimming made them look unavailable. */
  dimmed?: boolean;
  bestValue?: boolean;
  onPress?: () => void;
};

// Only the press-scale transform is animated. Every static style sits on plain Views:
// static styles on these Animated.Views (classes or style objects) were dropped on device,
// which left the card with no border, background or padding.
export function PlanCard({ plan, selected = false, bestValue = false, onPress }: PlanCardProps) {
  const { t } = useTranslation();
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();
  const data = dataParts(plan.data_mb);
  const price = formatPrice(plan.price, plan.currency);
  const perGb = formatPrice(Math.round(pricePerGb(plan)), plan.currency);
  const days = t('esim.days', { count: plan.validity_days });
  const features = [plan.is_5g ? t('esim.fiveG') : null, plan.hotspot ? t('esim.hotspot') : null].filter(Boolean).join(' · ');

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
      accessibilityLabel={[`${data.value} ${data.unit}`, days, features, price, bestValue ? t('esim.bestValue') : null]
        .filter(Boolean)
        .join(', ')}
    >
      <Animated.View style={animatedStyle}>
        <View
          className={cn(
            'flex-row items-center gap-4 rounded-card',
            selected ? 'border-2 border-fg bg-surface-2' : 'border border-line border-t-line-highlight bg-surface-1',
          )}
          // Same outer size in both states: the thicker selected border comes out of the padding.
          style={{ padding: selected ? 15 : 16 }}
        >
          <View
            className={cn('items-center justify-center rounded-pill', selected ? 'bg-fg' : 'border-2 border-line-strong')}
            style={{ width: 24, height: 24 }}
          >
            {selected ? <Icon name="check" size={12} tone="inverse" weight="bold" /> : null}
          </View>

          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="data-sm">
                {data.value}
                <Text variant="callout" weight="semibold" tone="secondary">{` ${data.unit}`}</Text>
              </Text>
              {bestValue ? <Pill label={t('esim.bestValue')} tone="accent" size="sm" /> : null}
            </View>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {features ? `${days} · ${features}` : days}
            </Text>
          </View>

          <View className="items-end gap-1">
            <Text variant="data-sm">{price}</Text>
            <Text variant="caption" tone="tertiary">
              {t('esim.perGb', { price: perGb })}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
