import { colors, distances } from '@vela/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptics } from '@/lib/haptics';
import { VelaSplash } from './VelaSplash';

export type PullMarkProps = {
  scrollY: SharedValue<number>;
  refreshing: boolean;
};

export function PullMark({ scrollY, refreshing }: PullMarkProps) {
  const insets = useSafeAreaInsets();
  const progress = useDerivedValue(() => interpolate(-scrollY.get(), [0, distances.pullToRefresh], [0, 1], Extrapolation.CLAMP));

  useAnimatedReaction(
    () => progress.get() >= 1,
    (armed, previous) => {
      if (armed && previous === false) scheduleOnRN(haptics.tick);
    },
  );

  // Static values live inside the worklet: static styles passed next to an animated style were dropped on device.
  const topInset = insets.top;
  const style = useAnimatedStyle(() => {
    const pulled = Math.max(0, -scrollY.get());
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      top: topInset,
      alignItems: 'center',
      opacity: refreshing ? 1 : interpolate(progress.get(), [0, 0.15, 1], [0, 0.6, 1]),
      transform: [{ translateY: refreshing ? 8 : Math.min(pulled * 0.45, distances.pullToRefresh * 0.45) - 12 }],
    };
  });

  return (
    <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={style}>
      {refreshing ? (
        <VelaSplash mode="loop" markHeight={26} color={colors.accent.DEFAULT} className="h-10 w-24" />
      ) : (
        <VelaSplash mode="build" markHeight={26} progress={progress} color={colors.accent.DEFAULT} className="h-10 w-24" />
      )}
    </Animated.View>
  );
}
