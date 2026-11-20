import { BlurView } from 'expo-blur';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/hooks/usePressScale';
import { cn } from '@/lib/cn';
import { triggerHaptic, type HapticKind } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { Icon } from './Icon';
import type { Tone } from './tone';

export type IconButtonVariant = 'surface' | 'glass' | 'ghost' | 'primary';
export type IconButtonSize = 'md' | 'sm';

export type IconButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  haptic?: HapticKind | false;
  className?: string;
};

const variantClass: Record<IconButtonVariant, string> = {
  surface: 'border border-line bg-surface-2',
  glass: 'border border-line',
  ghost: 'bg-transparent',
  primary: 'bg-fg',
};

const iconTone: Record<IconButtonVariant, Tone> = {
  surface: 'primary',
  glass: 'primary',
  ghost: 'primary',
  primary: 'inverse',
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'surface',
  size = 'md',
  disabled = false,
  haptic = 'tap',
  className,
}: IconButtonProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressScale({ scale: 0.94, brightenBorder: variant !== 'ghost' && variant !== 'primary' });

  function handlePress() {
    triggerHaptic(haptic);
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={size === 'sm' ? 6 : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      className={cn('self-start', className)}
    >
      <Animated.View
        style={animatedStyle}
        className={cn(
          'items-center justify-center overflow-hidden rounded-pill',
          size === 'md' ? 'h-11 w-11' : 'h-8 w-8',
          variantClass[variant],
          disabled && 'opacity-40',
        )}
      >
        {variant === 'glass' ? <BlurView intensity={40} tint="dark" className="absolute inset-0" /> : null}
        <Icon name={icon} size={size === 'md' ? 18 : 14} tone={iconTone[variant]} weight="semibold" />
      </Animated.View>
    </Pressable>
  );
}
