import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { colors, durations } from '@vela/tokens';
import { useEffect } from 'react';
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const SIZE = 320;
const CENTER = SIZE / 2;

function Ring({ delay }: { delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration: durations.ripple, easing: Easing.out(Easing.cubic) })));
  }, [delay, progress]);
  const radius = useDerivedValue(() => 80 + progress.get() * (CENTER - 82));
  const opacity = useDerivedValue(() => (1 - progress.get()) * 0.55);
  return (
    <Group opacity={opacity}>
      <Circle cx={CENTER} cy={CENTER} r={radius} style="stroke" strokeWidth={1.5} color={colors.accent.DEFAULT} />
    </Group>
  );
}

export function SignalRipple() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <Canvas pointerEvents="none" className="absolute h-[320px] w-[320px]">
      <Ring delay={0} />
      <Ring delay={160} />
      <Ring delay={320} />
    </Canvas>
  );
}
