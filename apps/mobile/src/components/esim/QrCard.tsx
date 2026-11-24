import { Canvas, Path } from '@shopify/react-native-skia';
import { VelaSymbol } from '@vela/brand/native';
import { colors, durations, radii } from '@vela/tokens';
import QRCode from 'qrcode';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Button, Text } from '@/components/ui';
import { timing } from '@/lib/motion';

const QR_PX = 168;
const INK = '#0A0A0A';

function qrPath(text: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const cell = QR_PX / modules.size;
  let d = '';
  for (let row = 0; row < modules.size; row += 1) {
    let col = 0;
    while (col < modules.size) {
      if (!modules.get(row, col)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < modules.size && modules.get(row, col)) col += 1;
      d += `M${(start * cell).toFixed(2)} ${(row * cell).toFixed(2)}h${((col - start) * cell).toFixed(2)}v${cell.toFixed(2)}h-${((col - start) * cell).toFixed(2)}z`;
    }
  }
  return d;
}

export type QrCardProps = {
  value: string;
  revealed?: boolean;
  flipOnMount?: boolean;
  onReveal?: () => void;
};

// Static layout goes in `style` here: NativeWind classes on an Animated.View that also has an animated style get dropped.
const face = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: radii.cardLg,
} as const;

const backFace = {
  gap: 20,
  borderWidth: 1,
  borderColor: colors.line.DEFAULT,
  borderTopColor: colors.line.highlight,
  backgroundColor: colors.surface[2],
} as const;

export function QrCard({ value, revealed = true, flipOnMount = false, onReveal }: QrCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const path = useMemo(() => qrPath(value), [value]);
  const flip = useSharedValue(revealed && !flipOnMount ? 1 : 0);

  useEffect(() => {
    const target = revealed ? 1 : 0;
    flip.set(
      reduceMotion ? withTiming(target, timing(durations.base)) : withSpring(target, { duration: durations.flip, dampingRatio: 0.85 }),
    );
  }, [revealed, reduceMotion, flip]);

  // Static values live inside the worklet: static styles passed next to an animated style were dropped on device.
  const backStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { ...face, ...backFace, opacity: 1 - flip.get() }
      : {
          ...face,
          ...backFace,
          backfaceVisibility: 'hidden',
          transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.get(), [0, 1], [0, 180])}deg` }],
        },
  );
  const frontStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { ...face, backgroundColor: '#FFFFFF', opacity: flip.get() }
      : {
          ...face,
          backgroundColor: '#FFFFFF',
          backfaceVisibility: 'hidden',
          transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.get(), [0, 1], [180, 360])}deg` }],
        },
  );

  return (
    <View className="h-[232px] w-[232px] self-center">
      <Animated.View style={backStyle} pointerEvents={revealed ? 'none' : 'auto'}>
        <VelaSymbol size={48} className="text-accent" />
        {onReveal ? <Button label={t('esim.revealQr')} size="sm" pill variant="secondary" icon="qr" onPress={onReveal} /> : null}
      </Animated.View>
      <Animated.View
        accessible={revealed}
        accessibilityRole="image"
        accessibilityLabel={t('esim.qrLabel')}
        accessibilityHint={t('esim.qrHint')}
        style={frontStyle}
      >
        <Canvas className="h-[168px] w-[168px]">
          <Path path={path} color={INK} />
        </Canvas>
      </Animated.View>
    </View>
  );
}

export function QrHint() {
  const { t } = useTranslation();
  return (
    <Text variant="caption" tone="tertiary" align="center">
      {t('esim.qrHint')}
    </Text>
  );
}
