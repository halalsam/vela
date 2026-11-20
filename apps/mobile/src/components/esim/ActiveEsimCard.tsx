import type { Esim } from '@vela/api';
import { formatShortDate, isLowData } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Pill, Text, type StatusTone } from '@/components/ui';
import { Flag } from './Flag';
import { ringStateFor, UsageRing } from './UsageRing';
import { ValidityCountdown } from './ValidityCountdown';

export type ActiveEsimCardProps = {
  esim: Esim;
  onPress?: () => void;
  onTopUp?: () => void;
};

export function ActiveEsimCard({ esim, onPress, onTopUp }: ActiveEsimCardProps) {
  const { t, i18n } = useTranslation();
  const state = ringStateFor(esim.data_used_mb, esim.data_total_mb, esim.status);
  const low = esim.status === 'active' && isLowData(esim.data_used_mb, esim.data_total_mb);
  const status: { label: string; tone: StatusTone } =
    esim.status === 'not_started'
      ? { label: t('esim.statusNotStarted'), tone: 'neutral' }
      : esim.status === 'active'
        ? low
          ? { label: t('esim.low'), tone: 'warning' }
          : { label: t('esim.active'), tone: 'success' }
        : { label: t('esim.statusExpired'), tone: 'danger' };
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const code = esim.country_codes[0] ?? 'UN';

  return (
    <Card padding="lg" onPress={onPress} accessibilityLabel={`${esim.label}, ${status.label}`} className="gap-5">
      <View className="flex-row items-center gap-3">
        <Flag code={code} size="lg" />
        <View className="flex-1">
          <Text variant="title" numberOfLines={1}>
            {esim.label}
          </Text>
          <Text variant="caption" tone="tertiary">
            {[esim.network, esim.is_5g ? t('esim.fiveG') : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pill label={status.label} tone={status.tone} dot />
      </View>
      <View className="flex-row items-center gap-5">
        <UsageRing usedMb={esim.data_used_mb} totalMb={esim.data_total_mb} state={state} size="md" />
        <View className="flex-1 gap-3">
          {esim.expires_at ? (
            <Text variant="callout" tone="secondary">
              {t('esim.validUntil', { date: formatShortDate(esim.expires_at, language) })}
            </Text>
          ) : null}
          <ValidityCountdown expiresAt={esim.expires_at} variant="pill" precision="hours" />
          {esim.status === 'active' && onTopUp ? (
            <Button label={t('esim.topUp')} size="sm" pill icon="plus" variant={low ? 'primary' : 'secondary'} onPress={onTopUp} />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
