import type { DailyUsage, Esim, TopUpPack } from '@vela/api';
import { colors, durations, radii } from '@vela/tokens';
import { formatData, formatPrice, formatShortDate } from '@vela/utils';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Card, ListGroup, ListRow, Pill, Text, toast } from '@/components/ui';
import { useCopy } from '@/hooks/useCopy';
import { useEsimTitle } from '@/hooks/usePlanTitle';
import { velaEasing } from '@/lib/motion';

const BAR_MAX = 88;

function Bar({ fraction, index, highlight }: { fraction: number; index: number; highlight: boolean }) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    grow.set(withDelay(index * 60, withTiming(1, { duration: durations.slow * 1.5, easing: velaEasing })));
  }, [grow, index, reduceMotion]);
  // Static values live inside the worklet: static styles passed next to an animated style were dropped on device.
  const fill = highlight ? colors.accent.DEFAULT : colors.surface[3];
  const style = useAnimatedStyle(() => ({
    width: '100%',
    borderRadius: radii.chip,
    backgroundColor: fill,
    height: Math.max(4, fraction * BAR_MAX * grow.get()),
  }));
  return <Animated.View style={style} />;
}

export function UsageBars({ days }: { days: readonly DailyUsage[] }) {
  const { t, i18n } = useTranslation();
  if (days.length === 0) return null;
  const max = Math.max(...days.map((day) => day.used_mb), 1);
  const average = days.reduce((sum, day) => sum + day.used_mb, 0) / days.length;
  const weekday = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { weekday: 'narrow' });
  return (
    <Card padding="lg" className="gap-4">
      <View className="flex-row items-baseline justify-between">
        <Text variant="title">{t('usage.last7')}</Text>
        <Text variant="caption" tone="tertiary">
          {t('usage.avgPerDay', { value: formatData(average) })}
        </Text>
      </View>
      <View
        className="h-[112px] flex-row items-end gap-2.5"
        accessible
        accessibilityLabel={t('usage.avgPerDay', { value: formatData(average) })}
      >
        {days.map((day, index) => (
          <View key={day.date} className="flex-1 items-center gap-1.5">
            <Bar fraction={day.used_mb / max} index={index} highlight={index === days.length - 1} />
            <Text variant="caption" tone="tertiary">
              {weekday.format(new Date(day.date))}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function UsageDetails({ esim }: { esim: Esim }) {
  const { t, i18n } = useTranslation();
  const esimTitle = useEsimTitle();
  const { copy } = useCopy();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  return (
    <ListGroup>
      <ListRow title={t('usage.plan')} value={esimTitle(esim)} />
      <ListRow title={t('usage.network')} value={[esim.network, esim.is_5g ? t('esim.fiveG') : null].filter(Boolean).join(' · ')} />
      {esim.status === 'active' ? <ListRow title={t('usage.roaming')} value={t('usage.roamingOn')} /> : null}
      {esim.expires_at ? <ListRow title={t('usage.validUntil')} value={formatShortDate(esim.expires_at, language)} /> : null}
      <ListRow
        title={t('usage.iccid')}
        subtitle={esim.iccid}
        trailing={<Pill label={t('common.copy')} icon="copy" size="sm" />}
        chevron={false}
        onPress={() => {
          void copy(esim.iccid);
          toast.show({ message: t('usage.copied'), tone: 'success', icon: 'check' });
        }}
      />
    </ListGroup>
  );
}

export function TopUpOption({ pack, selected, onPress }: { pack: TopUpPack; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Card
      selected={selected}
      onPress={onPress}
      haptic="selection"
      accessibilityLabel={`+${formatData(pack.data_mb)}, ${formatPrice(pack.price, pack.currency)}`}
      className="flex-row items-center gap-3"
    >
      <View className="flex-1 flex-row items-baseline gap-2">
        <Text variant="data-md">{`+${formatData(pack.data_mb)}`}</Text>
        {pack.extra_days > 0 ? <Pill label={t('topUp.extraDays', { count: pack.extra_days })} tone="accent" size="sm" /> : null}
      </View>
      <Text variant="data-sm">{formatPrice(pack.price, pack.currency)}</Text>
    </Card>
  );
}
