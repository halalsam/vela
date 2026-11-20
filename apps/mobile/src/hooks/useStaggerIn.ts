import { distances, durations } from '@vela/tokens';
import { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { reducedFadeIn, velaEasing } from '@/lib/motion';

const STEP_MS = durations.stagger;
const MAX_STEPS = 8;

export function useStaggerIn(index: number, { step = STEP_MS }: { step?: number } = {}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return reducedFadeIn;
  return FadeInUp.delay(Math.min(index, MAX_STEPS) * step)
    .duration(durations.slow)
    .easing(velaEasing)
    .withInitialValues({ opacity: 0, transform: [{ translateY: distances.riseOffset }] });
}
