import type { Esim } from '@vela/api';
import { countdownParts, dataParts, formatData, formatShortDate, isEndingSoon, isLowData, remainingFraction } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Icon, Text, type Tone } from '@/components/ui';
import { useCountryName } from '@/hooks/useCountryName';
import { useNow } from '@/hooks/useNow';
import { usePressScale } from '@/hooks/usePressScale';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { CountryMap } from './CountryMap';
import { Flag } from './Flag';

export type ActiveEsimCardProps = {
  esim: Esim;
  onPress?: () => void;
  onTopUp?: () => void;
  onSetup?: () => void;
};

type Kind = 'active' | 'low' | 'ready' | 'ended';

const SEGMENTS = 22;

function StatusPill({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const spec: Record<Kind, { label: string; box: string; dot: string; tone: Tone }> = {
    active: { label: t('esim.active'), box: 'bg-success-tint', dot: 'bg-success', tone: 'success' },
    low: { label: t('esim.low'), box: 'bg-warning-tint', dot: 'bg-warning', tone: 'warning' },
    ready: { label: t('esim.ready'), box: 'bg-surface-3', dot: 'border border-fg-secondary', tone: 'primary' },
    ended: { label: t('esim.statusExpired'), box: 'bg-danger-tint', dot: 'bg-danger', tone: 'danger' },
  };
  const { label, box, dot, tone } = spec[kind];
  return (
    <View className={cn('flex-row items-center gap-1.5 rounded-chip px-2 py-0.5', box)}>
      <View className={cn('rounded-pill', dot)} style={{ width: 6, height: 6 }} />
      <Text variant="caption" weight="semibold" tone={tone}>
        {label}
      </Text>
    </View>
  );
}

function UsageBar({ fraction, kind }: { fraction: number; kind: Kind }) {
  if (kind === 'ready') {
    // Dashed track: the plan hasn't started, so there is nothing used yet.
    return (
      <View className="flex-row gap-1" style={{ height: 4 }}>
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <View key={index} className="flex-1 rounded-pill bg-surface-3" />
        ))}
      </View>
    );
  }
  const percent = Math.max(kind === 'ended' ? 0 : 3, Math.round(fraction * 100));
  return (
    <View className="overflow-hidden rounded-pill bg-surface-3" style={{ height: 4 }}>
      <View className={cn('h-full rounded-pill', kind === 'low' ? 'bg-warning' : 'bg-accent')} style={{ width: `${percent}%` }} />
    </View>
  );
}

export function ActiveEsimCard({ esim, onPress, onTopUp, onSetup }: ActiveEsimCardProps) {
  const { t, i18n } = useTranslation();
  const countryName = useCountryName();
  const now = useNow(60_000);
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();
  const language = i18n.language === 'ar' ? 'ar' : 'en';

  const ended = esim.status === 'expired' || esim.status === 'depleted';
  const low = esim.status === 'active' && isLowData(esim.data_used_mb, esim.data_total_mb);
  const kind: Kind = ended ? 'ended' : esim.status === 'not_started' ? 'ready' : low ? 'low' : 'active';

  const single = esim.country_codes.length === 1;
  const code = single ? (esim.country_codes[0] ?? 'UN') : 'UN';
  const title = single ? countryName(code) : esim.label;
  const remaining = Math.max(0, esim.data_total_mb - esim.data_used_mb);
  const amount = dataParts(kind === 'ready' ? esim.data_total_mb : remaining);
  const subtitle = [formatData(esim.data_total_mb), esim.network, esim.is_5g ? t('esim.fiveG') : null].filter(Boolean).join(' · ');

  const parts = esim.expires_at ? countdownParts(esim.expires_at, now) : null;
  const countdown =
    parts && !parts.expired ? `${parts.days > 0 ? `${parts.days}${t('esim.dayUnit')} ` : ''}${parts.hours}${t('esim.hourUnit')}` : null;
  const urgent = parts ? isEndingSoon(parts) : false;

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${amount.value} ${amount.unit}`}
    >
      <Animated.View style={animatedStyle}>
        <View
          className={cn(
            'gap-3 overflow-hidden rounded-card border bg-surface-1 p-3.5',
            kind === 'low' ? 'border-warning/40' : 'border-line border-t-line-highlight',
          )}
        >
          {/* Country silhouette as a quiet watermark behind the numbers. */}
          {single ? <CountryMap code={code} width={150} height={120} opacity={0.07} className="absolute -end-4 top-8" /> : null}

          <View className="flex-row items-center gap-3">
            <Flag code={code} size="md" className={cn(ended && 'opacity-50')} />
            <View className="flex-1 gap-0.5">
              <Text variant="callout" weight="semibold" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <StatusPill kind={kind} />
          </View>

          <View className="gap-2">
            <View className="flex-row items-end justify-between gap-3">
              <View className="flex-row items-baseline gap-2">
                <Text
                  variant="display-lg"
                  tone={kind === 'low' ? 'warning' : ended ? 'tertiary' : 'primary'}
                  className="text-[28px] leading-[32px]"
                >
                  {ended ? '0' : amount.value}
                </Text>
                <Text variant="callout" weight="medium" tone="secondary">
                  {t(kind === 'ready' ? 'esim.unitReady' : 'esim.unitLeft', { unit: amount.unit })}
                </Text>
              </View>
              <Text variant="caption" tone="tertiary" className="pb-1.5">
                {kind === 'ready' ? t('esim.statusNotStarted') : t('esim.ofTotal', { total: formatData(esim.data_total_mb) })}
              </Text>
            </View>
            <UsageBar fraction={remainingFraction(esim.data_used_mb, esim.data_total_mb)} kind={kind} />
            {kind === 'ready' ? (
              <View className="flex-row items-center gap-2">
                <Icon name="airplane" size={13} tone="secondary" />
                <Text variant="caption" tone="secondary">
                  {t('esim.startsOnLanding')}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-between gap-3">
                <Text variant="caption" tone="tertiary">
                  {esim.expires_at ? t('esim.expires', { date: formatShortDate(esim.expires_at, language) }) : ''}
                </Text>
                {countdown ? (
                  <View className="flex-row items-center gap-1.5" style={{ direction: 'ltr' }}>
                    <Icon name="clock" size={12} tone={urgent ? 'warning' : 'secondary'} />
                    <Text variant="caption" weight="semibold" tone={urgent ? 'warning' : 'primary'}>
                      {t('esim.countdown', { time: countdown })}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View className="flex-row gap-2">
            {kind === 'ready' ? (
              <View className="flex-1">
                <Button label={t('esim.setupGuide')} variant="secondary" size="sm" icon="info" fullWidth onPress={onSetup} />
              </View>
            ) : kind !== 'ended' && onTopUp ? (
              <View className="flex-1">
                <Button
                  label={t(kind === 'low' ? 'esim.topUpNow' : 'esim.topUp')}
                  variant={kind === 'low' ? 'primary' : 'secondary'}
                  size="sm"
                  icon="plus"
                  fullWidth
                  onPress={onTopUp}
                />
              </View>
            ) : null}
            <View className="flex-1">
              <Button
                label={t('esim.details')}
                variant="outline"
                size="sm"
                icon="chevronForward"
                iconPosition="end"
                fullWidth
                onPress={onPress}
              />
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
