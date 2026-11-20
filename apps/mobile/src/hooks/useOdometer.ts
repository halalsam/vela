import { useEffect } from 'react';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { velaSpring } from '@/lib/motion';

export function useOdometer(digit: number, rowHeight: number) {
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(digit);

  useEffect(() => {
    position.set(reduceMotion ? digit : withSpring(digit, velaSpring));
  }, [digit, reduceMotion, position]);

  return useAnimatedStyle(() => ({ transform: [{ translateY: -position.get() * rowHeight }] }));
}
