import { colors, durations, scales } from '@vela/tokens';
import { useCallback } from 'react';
import {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { timing, velaSpring } from '@/lib/motion';

type PressScaleOptions = {
  scale?: number;
  brightenBorder?: boolean;
  restingBorder?: string;
};

export function usePressScale({
  scale = scales.press,
  brightenBorder = false,
  restingBorder = colors.line.DEFAULT,
}: PressScaleOptions = {}) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    pressed.set(withTiming(1, timing(durations.instant)));
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.set(reduceMotion ? withTiming(0, timing(durations.fast)) : withSpring(0, velaSpring));
  }, [pressed, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const progress = pressed.get();
    const style: { transform: { scale: number }[]; borderColor?: string } = {
      transform: [{ scale: reduceMotion ? 1 : interpolate(progress, [0, 1], [1, scale]) }],
    };
    if (brightenBorder) {
      style.borderColor = interpolateColor(progress, [0, 1], [restingBorder, colors.line.strong]);
    }
    return style;
  });

  return { pressed, onPressIn, onPressOut, animatedStyle };
}
