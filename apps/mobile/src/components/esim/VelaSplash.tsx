import { Canvas, Group, Path, usePathValue } from '@shopify/react-native-skia';
import { brandName, markGeometry } from '@vela/brand';
import { colors, durations, easing } from '@vela/tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { cn } from '@/lib/cn';

export type VelaSplashMode = 'intro' | 'build' | 'loop';

export type VelaSplashProps = {
  mode?: VelaSplashMode;
  markHeight?: number;
  color?: string;
  onFinish?: () => void;
  accessibilityLabel?: string;
  progress?: SharedValue<number>;
  className?: string;
};

const lockup = markGeometry.horizontal;
const [symbolPath, wordmarkPath] = lockup.paths;
const [sailPath, bandPath] = splitSubpaths(symbolPath?.d ?? '');
const SYMBOL_WIDTH = markGeometry.symbol.width;
const LOCKUP_WIDTH = lockup.width;
const MARK_HEIGHT = lockup.height;
const CENTER_X = 0;
const CENTER_Y = MARK_HEIGHT;
const SWEEP_RADIUS = MARK_HEIGHT * 1.2;
const SEXTANT = 60;
const START_ANGLE = -90;

const INTRO_MS = durations.splash;
const LOOP_MS = durations.splashLoop;
const HOLD_MS = durations.splashHold;

const [x1, y1, x2, y2] = easing.vela;
const ease = Easing.bezierFn(x1, y1, x2, y2);

function splitSubpaths(d: string): [string, string] {
  const index = d.indexOf(' M', 1);
  return index === -1 ? [d, ''] : [d.slice(0, index), d.slice(index + 1)];
}

function phase(t: number, start: number, end: number) {
  'worklet';
  const raw = (t - start) / (end - start);
  return ease(Math.min(1, Math.max(0, raw)));
}

export function VelaSplash({
  mode = 'intro',
  markHeight = 97,
  color = colors.fg.DEFAULT,
  onFinish,
  accessibilityLabel = brandName,
  progress,
  className,
}: VelaSplashProps) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const t = useSharedValue(0);
  const showName = mode === 'intro';

  useEffect(() => {
    if (progress) return;
    const finish = onFinish;
    if (reduceMotion) {
      t.set(
        mode === 'loop'
          ? withRepeat(withTiming(LOOP_MS, { duration: LOOP_MS, reduceMotion: ReduceMotion.Never }), -1, true, undefined, ReduceMotion.Never)
          : withTiming(INTRO_MS, { duration: durations.splashReduced, reduceMotion: ReduceMotion.Never }, (finished) => {
              'worklet';
              if (finished && finish) scheduleOnRN(finish);
            }),
      );
      return () => cancelAnimation(t);
    }
    if (mode === 'loop') {
      t.set(withRepeat(withTiming(LOOP_MS, { duration: LOOP_MS, easing: Easing.linear }), -1, false));
    } else {
      const end = mode === 'intro' ? INTRO_MS : 1000;
      t.set(
        withSequence(
          withTiming(end, { duration: end, easing: Easing.linear }),
          withTiming(end, { duration: HOLD_MS }, (finished) => {
            'worklet';
            if (finished && finish) scheduleOnRN(finish);
          }),
        ),
      );
    }
    return () => cancelAnimation(t);
  }, [mode, reduceMotion, onFinish, t, progress]);

  const clock = useDerivedValue(() => (progress ? progress.get() * 1000 : t.get()));

  const sail = useDerivedValue(() => {
    if (reduceMotion && !progress) return 1;
    const time = clock.get();
    return mode === 'loop' ? phase(time, 0, 500) : phase(time, 0, 520);
  });

  const band = useDerivedValue(() => {
    if (reduceMotion && !progress) return 1;
    const time = clock.get();
    return mode === 'loop' ? phase(time, 350, 900) : phase(time, 380, 1000);
  });

  const markOpacity = useDerivedValue(() => {
    const time = clock.get();
    if (progress) return Math.min(1, time / 300);
    if (reduceMotion) return mode === 'loop' ? 0.4 + 0.6 * (time / LOOP_MS) : Math.min(1, time / INTRO_MS);
    if (mode === 'loop') return 1 - phase(time, 1300, LOOP_MS);
    return 1;
  });

  const name = useDerivedValue(() => {
    if (!showName) return 0;
    if (reduceMotion) return Math.min(1, clock.get() / INTRO_MS);
    return phase(clock.get(), 900, INTRO_MS);
  });

  const scale = markHeight / MARK_HEIGHT;

  const groupTransform = useDerivedValue(() => {
    const symbolX = (size.width - SYMBOL_WIDTH * scale) / 2;
    const lockupX = (size.width - LOCKUP_WIDTH * scale) / 2;
    const slide = showName && !reduceMotion ? phase(clock.get(), 850, INTRO_MS - 50) : showName ? 1 : 0;
    return [
      { translateX: symbolX + (lockupX - symbolX) * slide },
      { translateY: (size.height - MARK_HEIGHT * scale) / 2 },
      { scale },
    ];
  });

  const nameTransform = useDerivedValue(() => [{ translateY: (1 - name.get()) * 12 }]);

  const sailClip = usePathValue((builder) => {
    'worklet';
    const sweep = Math.max(0.01, SEXTANT * sail.get());
    builder.moveTo(CENTER_X, CENTER_Y);
    builder.arcToOval(
      { x: CENTER_X - SWEEP_RADIUS, y: CENTER_Y - SWEEP_RADIUS, width: SWEEP_RADIUS * 2, height: SWEEP_RADIUS * 2 },
      START_ANGLE,
      sweep,
      false,
    );
    builder.close();
  });

  const bandClip = usePathValue((builder) => {
    'worklet';
    const sweep = Math.max(0.01, SEXTANT * band.get());
    builder.moveTo(CENTER_X, CENTER_Y);
    builder.arcToOval(
      { x: CENTER_X - SWEEP_RADIUS, y: CENTER_Y - SWEEP_RADIUS, width: SWEEP_RADIUS * 2, height: SWEEP_RADIUS * 2 },
      START_ANGLE,
      sweep,
      false,
    );
    builder.close();
  });

  return (
    <View
      accessible
      accessibilityRole={mode === 'loop' ? 'progressbar' : 'image'}
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      className={cn('h-32 w-full', className)}
    >
      {size.width > 0 ? (
        <Canvas className="flex-1">
          <Group transform={groupTransform} opacity={markOpacity}>
            <Group clip={sailClip}>
              <Path path={sailPath} color={color} />
            </Group>
            <Group clip={bandClip}>
              <Path path={bandPath} color={color} />
            </Group>
            {showName && wordmarkPath ? (
              <Group opacity={name} transform={nameTransform}>
                <Path path={wordmarkPath.d} color={color} fillType="evenOdd" />
              </Group>
            ) : null}
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}
