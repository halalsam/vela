import { Canvas, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import type { Offer } from '@vela/api';
import { durations } from '@vela/tokens';
import { countdownParts } from '@vela/utils';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Pill, Text } from '@/components/ui';
import { usePressScale } from '@/hooks/usePressScale';
import { useDirection } from '@/i18n/useDirection';
import { useLocalized } from '@/i18n/useLocalized';
import { haptics } from '@/lib/haptics';

export const OFFER_CARD_WIDTH = 280;

const SWEEP = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'];
const GLOW = ['rgba(200,178,133,0.28)', 'rgba(200,178,133,0)'];

export type OfferCardProps = {
  offer: Offer;
  onPress?: () => void;
};

export function OfferCard({ offer, onPress }: OfferCardProps) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { isRTL } = useDirection();
  const reduceMotion = useReducedMotion();
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    sweep.set(
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: durations.sweep,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(1, { duration: durations.sweepRest }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [reduceMotion, sweep]);

  const sweepStart = useDerivedValue(() => {
    const x = interpolate(sweep.get(), [0, 1], [-size.width, size.width * 1.5]);
    return vec(isRTL ? size.width - x : x, 0);
  });
  const sweepEnd = useDerivedValue(() => {
    const x = interpolate(sweep.get(), [0, 1], [-size.width * 0.4, size.width * 2.1]);
    return vec(isRTL ? size.width - x : x, size.height);
  });

  const endsIn = offer.ends_at ? countdownParts(offer.ends_at) : null;
  const meta = offer.code
    ? t('esim.useCode', { code: offer.code })
    : endsIn && !endsIn.expired
      ? t('esim.offerEnds', {
          time: t('esim.days', { count: Math.max(1, endsIn.days) }),
        })
      : null;

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={[localized(offer.tag), localized(offer.title), localized(offer.body), meta].filter(Boolean).join(', ')}
      className="w-[280px]"
    >
      <Animated.View style={animatedStyle}>
        <View
          onLayout={(event) =>
            setSize({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
          style={{ height: 176 }}
          className="overflow-hidden rounded-card border border-line border-t-line-highlight bg-surface-2 p-section"
        >
          {size.width > 0 ? (
            <Canvas
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: size.width,
                height: size.height,
              }}
            >
              <Rect x={0} y={0} width={size.width} height={size.height}>
                <RadialGradient c={vec(isRTL ? 0 : size.width, 0)} r={size.width * 0.75} colors={GLOW} />
              </Rect>
              {reduceMotion ? null : (
                <Rect x={0} y={0} width={size.width} height={size.height}>
                  <LinearGradient start={sweepStart} end={sweepEnd} colors={SWEEP} />
                </Rect>
              )}
            </Canvas>
          ) : null}
          <View className="flex-1 justify-between">
            <Pill label={localized(offer.tag)} tone="accent" caps size="sm" />
            <View className="gap-1">
              <Text variant="display-md">{localized(offer.title)}</Text>
              <Text variant="callout" tone="secondary" numberOfLines={2}>
                {localized(offer.body)}
              </Text>
            </View>
            {meta ? (
              <Text variant="label-sm" tone="accent">
                {meta}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
