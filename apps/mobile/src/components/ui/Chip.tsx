import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/hooks/usePressScale';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { Icon } from './Icon';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
};

export function Chip({ label, selected = false, onPress, icon, disabled = false, className }: ChipProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressScale({ scale: 0.96 });
  const tone = selected ? 'primary' : 'secondary';
  const body = (
    <>
      {icon ? <Icon name={icon} size={13} tone={tone} weight="semibold" /> : null}
      <Text variant="callout" weight="medium" tone={tone} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const shape = cn(
    'h-9 flex-row items-center gap-1.5 rounded-pill border px-3.5',
    selected ? 'border-fg bg-surface-3' : 'border-line bg-transparent',
    disabled && 'opacity-40',
  );

  if (!onPress) {
    return <View className={cn(shape, 'self-start', className)}>{body}</View>;
  }

  function handlePress() {
    haptics.selection();
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      className={cn('self-start', className)}
    >
      <Animated.View style={animatedStyle} className={shape}>
        {body}
      </Animated.View>
    </Pressable>
  );
}
