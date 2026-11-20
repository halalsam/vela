import { Canvas, Path } from '@shopify/react-native-skia';
import { VelaSymbol } from '@vela/brand/native';
import { durations } from '@vela/tokens';
import QRCode from 'qrcode';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  onReveal?: () => void;
};

export function QrCard({ value, revealed = true, onReveal }: QrCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const path = useMemo(() => qrPath(value), [value]);
  const flip = useSharedValue(revealed ? 1 : 0);

  useEffect(() => {
    const target = revealed ? 1 : 0;
    flip.set(reduceMotion ? withTiming(target, timing(durations.base)) : withSpring(target, { duration: 700, dampingRatio: 0.85 }));
  }, [revealed, reduceMotion, flip]);

  const backStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - flip.get() }
      : {
          backfaceVisibility: 'hidden',
          transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.get(), [0, 1], [0, 180])}deg` }],
        },
  );
  const frontStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: flip.get() }
      : {
          backfaceVisibility: 'hidden',
          transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.get(), [0, 1], [180, 360])}deg` }],
        },
  );

  return (
    <View className="h-[232px] w-[232px] self-center">
      <Animated.View
        style={backStyle}
        pointerEvents={revealed ? 'none' : 'auto'}
        className="absolute inset-0 items-center justify-center gap-5 rounded-card-lg border border-line border-t-line-highlight bg-surface-2"
      >
        <VelaSymbol size={48} className="text-accent" />
        {onReveal ? <Button label={t('esim.revealQr')} size="sm" pill variant="secondary" icon="qr" onPress={onReveal} /> : null}
      </Animated.View>
      <Animated.View
        style={frontStyle}
        accessible={revealed}
        accessibilityRole="image"
        accessibilityLabel={t('esim.qrLabel')}
        accessibilityHint={t('esim.qrHint')}
        className="absolute inset-0 items-center justify-center rounded-card-lg bg-white"
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
