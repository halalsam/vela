import { colors, durations } from '@vela/tokens';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDirection } from '@/i18n/useDirection';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { reducedFadeIn, timing, velaSpring } from '@/lib/motion';
import { Icon } from './Icon';
import { Text } from './Text';
import { toneColor } from './tone';

export type SwipeToPayStatus = 'idle' | 'loading' | 'success';

export type SwipeToPayProps = {
  label: string;
  amount?: string;
  successLabel?: string;
  onComplete: () => void;
  status?: SwipeToPayStatus;
  disabled?: boolean;
  className?: string;
};

const THUMB = 56;
const INSET = 4;
const COMPLETE_AT = 0.85;
const FLICK_VELOCITY = 1200;

export function SwipeToPay({ label, amount, successLabel, onComplete, status = 'idle', disabled = false, className }: SwipeToPayProps) {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const maxX = Math.max(0, trackWidth - THUMB - INSET * 2);
  const locked = status !== 'idle';
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const armed = useSharedValue(false);

  const settle = useCallback(
    (to: number) => {
      'worklet';
      return reduceMotion ? withTiming(to, timing(durations.fast)) : withSpring(to, velaSpring);
    },
    [reduceMotion],
  );

  useEffect(() => {
    x.set(settle(status === 'idle' ? 0 : maxX));
  }, [status, maxX, settle, x]);

  const complete = useCallback(() => {
    haptics.press();
    onComplete();
  }, [onComplete]);

  const pan = usePanGesture({
    enabled: !disabled && !locked && maxX > 0,
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onBegin: () => {
      'worklet';
      startX.set(x.get());
    },
    onUpdate: (event) => {
      'worklet';
      const delta = isRTL ? -event.translationX : event.translationX;
      const next = Math.min(Math.max(startX.get() + delta, 0), maxX);
      x.set(next);
      const crossed = next >= maxX * COMPLETE_AT;
      if (crossed !== armed.get()) {
        armed.set(crossed);
        scheduleOnRN(haptics.tick);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      const velocity = isRTL ? -event.velocityX : event.velocityX;
      const current = x.get();
      const done = current >= maxX * COMPLETE_AT || (velocity > FLICK_VELOCITY && current > maxX * 0.5);
      armed.set(false);
      x.set(settle(done ? maxX : 0));
      if (done) scheduleOnRN(complete);
    },
  });

  // Static values live inside the worklet: static styles passed next to an animated style were dropped on device.
  const thumbStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 4,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.fg.DEFAULT,
    transform: [{ translateX: isRTL ? -x.get() : x.get() }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    width: x.get() + THUMB,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingStart: 56,
    opacity: interpolate(x.get(), [0, Math.max(1, maxX * 0.6)], [1, 0], Extrapolation.CLAMP),
  }));

  const spokenLabel = amount ? `${label}, ${amount}` : label;

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={status === 'success' && successLabel ? successLabel : spokenLabel}
        accessibilityHint={t('ui.swipeHint')}
        accessibilityState={{ disabled: disabled || locked, busy: status === 'loading' }}
        accessibilityActions={[{ name: 'activate', label: spokenLabel }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate' && !disabled && !locked) complete();
        }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        className={cn(
          'h-16 justify-center overflow-hidden rounded-pill border border-line border-t-line-highlight bg-surface-2',
          disabled && 'opacity-40',
          className,
        )}
      >
        <Animated.View style={fillStyle} />
        {status === 'success' && successLabel ? (
          <Animated.View entering={reducedFadeIn} className="items-center">
            <Text variant="body" weight="semibold">
              {successLabel}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View style={labelStyle}>
            <Text variant="body" weight="semibold" tone="secondary">
              {label}
            </Text>
            {amount ? <Text variant="data-sm">{amount}</Text> : null}
          </Animated.View>
        )}
        <Animated.View style={thumbStyle}>
          {status === 'loading' ? (
            <ActivityIndicator color={toneColor.inverse} />
          ) : (
            <Icon name={status === 'success' ? 'check' : 'arrowForward'} size={20} tone="inverse" weight="bold" />
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
