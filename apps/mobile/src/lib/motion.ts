import { durations, easing, reanimatedSpring } from '@vela/tokens';
import { Easing, FadeIn, FadeOut, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

const [x1, y1, x2, y2] = easing.vela;

export const velaEasing = Easing.bezier(x1, y1, x2, y2);

export const velaSpring: WithSpringConfig = {
  duration: reanimatedSpring.duration,
  dampingRatio: reanimatedSpring.dampingRatio,
};

export function timing(duration: number = durations.base): WithTimingConfig {
  return { duration, easing: velaEasing };
}

export const reducedFadeIn = FadeIn.duration(durations.fast).reduceMotion(ReduceMotion.Never);
export const reducedFadeOut = FadeOut.duration(durations.fast).reduceMotion(ReduceMotion.Never);
