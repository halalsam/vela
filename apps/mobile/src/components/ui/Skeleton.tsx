import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { durations } from '@vela/tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useDirection } from '@/i18n/useDirection';
import { cn } from '@/lib/cn';

const SHIMMER = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)'];

export type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  const { isRTL } = useDirection();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      reduceMotion
        ? withRepeat(withTiming(1, { duration: durations.shimmer, reduceMotion: ReduceMotion.Never }), -1, true, undefined, ReduceMotion.Never)
        : withRepeat(withTiming(1, { duration: durations.shimmer, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const band = Math.max(size.width * 0.5, 80);

  const start = useDerivedValue(() => {
    const travelled = interpolate(progress.get(), [0, 1], [-band, size.width + band]);
    const x = isRTL ? size.width - travelled : travelled;
    return vec(x - band / 2, 0);
  });

  const end = useDerivedValue(() => {
    const travelled = interpolate(progress.get(), [0, 1], [-band, size.width + band]);
    const x = isRTL ? size.width - travelled : travelled;
    return vec(x + band / 2, size.height);
  });

  const pulseStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 1], [0.55, 1]) }));

  return (
    <View
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('overflow-hidden rounded-chip bg-surface-2', className)}
    >
      {reduceMotion ? (
        <Animated.View style={pulseStyle} className="absolute inset-0 bg-surface-3" />
      ) : size.width > 0 ? (
        <Canvas className="absolute inset-0">
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient start={start} end={end} colors={SHIMMER} />
          </Rect>
        </Canvas>
      ) : null}
    </View>
  );
}
