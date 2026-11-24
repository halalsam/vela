import { countdownParts, isEndingSoon, pad2 } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Pill, Text, type StatusTone, type Tone } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';

const fadeIn = FadeIn.duration(220).reduceMotion(ReduceMotion.Never);
const fadeOut = FadeOut.duration(220).reduceMotion(ReduceMotion.Never);

function CrossfadeChar({ char, tone }: { char: string; tone: Tone }) {
  if (!/\d/.test(char)) {
    return (
      <Text variant="data-sm" tone={tone}>
        {char}
      </Text>
    );
  }
  return (
    <View>
      <Text variant="data-sm" className="opacity-0">
        0
      </Text>
      <Animated.View key={char} entering={fadeIn} exiting={fadeOut} className="absolute inset-0 items-center">
        <Text variant="data-sm" tone={tone}>
          {char}
        </Text>
      </Animated.View>
    </View>
  );
}

export type ValidityCountdownProps = {
  expiresAt: string | null;
  variant?: 'pill' | 'inline';
  precision?: 'hours' | 'seconds';
  className?: string;
};

export function ValidityCountdown({ expiresAt, variant = 'inline', precision = 'seconds', className }: ValidityCountdownProps) {
  const { t } = useTranslation();
  const now = useNow(precision === 'seconds' ? 1000 : 60_000);

  if (!expiresAt) {
    return variant === 'pill' ? (
      <Pill label={t('esim.notStarted')} className={className} />
    ) : (
      <Text variant="callout" tone="secondary" className={className}>
        {t('esim.notStarted')}
      </Text>
    );
  }

  const parts = countdownParts(expiresAt, now);
  const status: StatusTone = parts.expired ? 'danger' : isEndingSoon(parts) ? 'warning' : 'neutral';

  if (parts.expired) {
    return variant === 'pill' ? (
      <Pill label={t('esim.expired')} tone="danger" className={className} />
    ) : (
      <Text variant="callout" tone="danger" className={className}>
        {t('esim.expired')}
      </Text>
    );
  }

  const dayPart = parts.days > 0 ? `${parts.days}${t('esim.dayUnit')} ` : '';
  const time =
    precision === 'seconds'
      ? `${dayPart}${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`
      : `${dayPart}${parts.hours}${t('esim.hourUnit')}`;
  const tone: Tone = status === 'danger' ? 'danger' : status === 'warning' ? 'warning' : variant === 'pill' ? 'secondary' : 'primary';

  return (
    <View
      accessible
      accessibilityLabel={`${time} ${t('esim.timeLeft')}`}
      className={cn(
        'flex-row items-center gap-1.5 self-start',
        variant === 'pill' && 'h-8 rounded-chip px-3',
        variant === 'pill' && (status === 'warning' ? 'bg-warning-tint' : 'bg-surface-3'),
        className,
      )}
    >
      {/* Numbers always read left to right. `rtl:flex-row-reverse` also fired in LTR and printed "6d 13h" as "h31 d6". */}
      <View className="flex-row" style={{ direction: 'ltr' }}>
        {[...time].map((char, index) => (
          <CrossfadeChar key={`${time.length - index}`} char={char} tone={tone} />
        ))}
      </View>
      <Text variant="caption" tone="tertiary">
        {t('esim.timeLeft')}
      </Text>
    </View>
  );
}
