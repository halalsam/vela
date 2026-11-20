import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export function useScrollY() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  return { scrollY, onScroll };
}

type ParallaxOptions = {
  height: number;
  factor?: number;
};

export function useParallax(scrollY: SharedValue<number>, { height, factor = 0.5 }: ParallaxOptions) {
  const reduceMotion = useReducedMotion();
  return useAnimatedStyle(() => {
    const y = scrollY.get();
    const opacity = interpolate(y, [0, height * 0.8], [1, 0], Extrapolation.CLAMP);
    if (reduceMotion) return { opacity };
    const stretch = interpolate(y, [-height, 0], [1.5, 1], Extrapolation.CLAMP);
    const shift = y < 0 ? y / 2 : y * factor;
    return { opacity, transform: [{ translateY: shift }, { scale: stretch }] };
  });
}

export function useFadeRise(scrollY: SharedValue<number>, { start, distance = 80 }: { start: number; distance?: number }) {
  const reduceMotion = useReducedMotion();
  return useAnimatedStyle(() => {
    const progress = interpolate(scrollY.get(), [start - distance, start], [0, 1], Extrapolation.CLAMP);
    if (reduceMotion) return { opacity: progress };
    return { opacity: progress, transform: [{ translateY: (1 - progress) * 16 }] };
  });
}
