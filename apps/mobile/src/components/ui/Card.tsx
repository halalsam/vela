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
  containerClassName?: string;
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
  containerClassName,
}: CardProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();
  const surface = cn('rounded-card border', selected ? 'border-fg bg-surface-2' : variantClass[variant], paddingClass[padding], className);

  if (!onPress) {
    return <View className={cn(surface, containerClassName)}>{children}</View>;
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
      className={containerClassName}
    >
      <Animated.View style={animatedStyle}>
        {/* Surface classes live on a plain View: on this Reanimated Animated.View, className next to an animated style was dropped (unstyled buttons/cards). */}
        <View className={surface}>{children}</View>
      </Animated.View>
    </Pressable>
  );
}
