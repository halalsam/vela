import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/hooks/usePressScale';
import { cn } from '@/lib/cn';
import { triggerHaptic, type HapticKind } from '@/lib/haptics';

export type CardVariant = 'default' | 'raised' | 'outline';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  selected?: boolean;
  onPress?: () => void;
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  className?: string;
};

const variantClass: Record<CardVariant, string> = {
  default: 'border-line border-t-line-highlight bg-surface-1',
  raised: 'border-line border-t-line-highlight bg-surface-2',
  outline: 'border-line bg-transparent',
};

const paddingClass: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-gutter',
  lg: 'p-section',
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  selected = false,
  onPress,
  haptic = 'tap',
  accessibilityLabel,
  accessibilityHint,
  className,
}: CardProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressScale({ brightenBorder: !selected });
  const surface = cn(
    'rounded-card border',
    selected ? 'border-fg bg-surface-2' : variantClass[variant],
    paddingClass[padding],
    className,
  );

  if (!onPress) {
    return <View className={surface}>{children}</View>;
  }

  function handlePress() {
    triggerHaptic(haptic);
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
    >
      <Animated.View style={animatedStyle} className={surface}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
