import { durations } from '@vela/tokens';
import { useEffect } from 'react';
import { useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { velaEasing } from '@/lib/motion';

export function useRingDraw(target: number, { delay = 0, duration = durations.ringDraw } = {}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    const clamped = Math.min(1, Math.max(0, target));
    progress.set(reduceMotion ? clamped : withDelay(delay, withTiming(clamped, { duration, easing: velaEasing })));
  }, [target, delay, duration, reduceMotion, progress]);

  return progress;
}
