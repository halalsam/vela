import { durations } from '@vela/tokens';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

type CountUpOptions = {
  duration?: number;
  decimals?: number;
  from?: number;
};

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function useCountUp(target: number, { duration = durations.slow * 2, decimals = 1, from = 0 }: CountUpOptions = {}) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(from);
  const previous = useRef(from);

  useEffect(() => {
    if (reduceMotion) {
      previous.current = target;
      return;
    }
    const start = previous.current;
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      setValue(start + (target - start) * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else previous.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      previous.current = target;
    };
  }, [target, duration, reduceMotion]);

  return (reduceMotion ? target : value).toFixed(decimals);
}
