import { durations } from '@vela/tokens';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useDirection } from '@/i18n/useDirection';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { timing, velaSpring } from '@/lib/motion';
import { Text } from './Text';

export type TabItem<K extends string> = {
  key: K;
  label: string;
};

export type TabsProps<K extends string> = {
  items: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  className?: string;
};

const UNDERLINE_INSET = 16;

export function Tabs<K extends string>({ items, value, onChange, accessibilityLabel, className }: TabsProps<K>) {
  const { isRTL } = useDirection();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((item) => item.key === value));
  const position = useSharedValue(index);
  const segment = items.length > 0 ? width / items.length : 0;

  useEffect(() => {
    position.set(reduceMotion ? withTiming(index, timing(durations.fast)) : withSpring(index, velaSpring));
  }, [index, position, reduceMotion]);

  const underlineStyle = useAnimatedStyle(() => {
    const offset = position.get() * segment + UNDERLINE_INSET;
    return {
      width: Math.max(0, segment - UNDERLINE_INSET * 2),
      transform: [{ translateX: isRTL ? -offset : offset }],
    };
  });

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className={cn('border-b border-line', className)}
    >
      <View className="flex-row">
        {items.map((item) => {
          const selected = item.key === value;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (selected) return;
                haptics.selection();
                onChange(item.key);
              }}
              className="h-11 flex-1 items-center justify-center"
            >
              <Text variant="callout" weight={selected ? 'semibold' : 'medium'} tone={selected ? 'primary' : 'tertiary'}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {width > 0 ? <Animated.View style={underlineStyle} className="absolute -bottom-px left-0 h-0.5 rounded-pill bg-fg" /> : null}
    </View>
  );
}
