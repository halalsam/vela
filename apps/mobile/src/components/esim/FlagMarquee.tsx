import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Flag, type FlagSize } from './Flag';

export type FlagMarqueeProps = {
  codes: readonly string[];
  size?: FlagSize;
  /** Points per second. */
  speed?: number;
  reverse?: boolean;
};

const GAP = 12;

/** A slow, endless row of flags. Holds still when the user prefers reduced motion. */
export function FlagMarquee({ codes, size = 'lg', speed = 18, reverse = false }: FlagMarqueeProps) {
  const reduceMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || rowWidth === 0) {
      cancelAnimation(offset);
      offset.set(0);
      return;
    }
    offset.set(0);
    offset.set(
      withRepeat(
        withTiming(rowWidth, {
          duration: (rowWidth / speed) * 1000,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(offset);
  }, [reduceMotion, rowWidth, speed, offset]);

  // Static values live inside the worklet: static styles passed next to an animated style were dropped on device.
  const trackStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    transform: [{ translateX: reverse ? offset.get() - rowWidth : -offset.get() }],
  }));

  const row = (copy: number) => (
    <View
      key={copy}
      onLayout={copy === 0 ? (event) => setRowWidth(event.nativeEvent.layout.width) : undefined}
      style={{ flexDirection: 'row', gap: GAP, paddingEnd: GAP }}
    >
      {codes.map((code) => (
        <Flag key={code} code={code} size={size} />
      ))}
    </View>
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ overflow: 'hidden', direction: 'ltr' }}
    >
      <Animated.View style={trackStyle}>
        {row(0)}
        {row(1)}
      </Animated.View>
    </View>
  );
}
