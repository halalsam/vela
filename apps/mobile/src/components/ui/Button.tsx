import { radii } from '@vela/tokens';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/hooks/usePressScale';
import { cn } from '@/lib/cn';
import { triggerHaptic, type HapticKind } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { Icon } from './Icon';
import { Text } from './Text';
import { toneColor, type Tone } from './tone';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'danger';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Custom leading graphic, such as a brand logo. Takes the place of `icon`. */
  leading?: ReactNode;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  pill?: boolean;
  haptic?: HapticKind | false;
  accessibilityHint?: string;
  className?: string;
  testID?: string;
};

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-fg',
  secondary: 'border border-line bg-surface-2',
  outline: 'border border-line-strong bg-transparent',
  ghost: 'bg-transparent',
  accent: 'bg-accent',
  danger: 'bg-danger-tint',
};

const labelTone: Record<ButtonVariant, Tone> = {
  primary: 'inverse',
  secondary: 'primary',
  outline: 'primary',
  ghost: 'primary',
  accent: 'inverse',
  danger: 'danger',
};

const sizeClass: Record<ButtonSize, string> = {
  md: 'h-button gap-2 px-6',
  sm: 'h-button-compact gap-1.5 px-4',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  leading,
  iconPosition = 'start',
  loading = false,
  disabled = false,
  fullWidth = false,
  pill = false,
  haptic = 'tap',
  accessibilityHint,
  className,
  testID,
}: ButtonProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();
  const inactive = disabled || loading;
  const tone = labelTone[variant];
  const iconNode = leading ? leading : icon ? <Icon name={icon} size={size === 'md' ? 18 : 15} tone={tone} /> : null;

  function handlePress() {
    triggerHaptic(haptic);
    onPress?.();
  }

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inactive}
      hitSlop={size === 'sm' ? 4 : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={cn(fullWidth ? 'self-stretch' : 'self-start', className)}
    >
      <Animated.View style={animatedStyle}>
        {/* Surface classes live on a plain View: on this Reanimated Animated.View, className next to an animated style was dropped (unstyled buttons/cards). */}
        <View
          className={cn(
            'flex-row items-center justify-center',
            containerClass[variant],
            sizeClass[size],
            disabled && 'opacity-40',
          )}
          // Radius from the token in code, not a class, so it always matches the native Apple
          // sign-in button (which takes the same token). `pill` is kept for API compatibility.
          style={{ borderRadius: radii.button }}
        >
          <View className={cn('flex-row items-center gap-2', loading && 'opacity-0')}>
            {iconPosition === 'start' ? iconNode : null}
            <Text variant={size === 'md' ? 'body' : 'callout'} weight="semibold" tone={tone} numberOfLines={1}>
              {label}
            </Text>
            {iconPosition === 'end' ? iconNode : null}
          </View>
          {loading ? <ActivityIndicator className="absolute" color={toneColor[tone]} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}
