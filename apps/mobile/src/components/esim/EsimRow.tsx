import type { Esim } from '@vela/api';
import { formatData, formatShortDate } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Button, Icon, Text } from '@/components/ui';
import { useEsimTitle } from '@/hooks/usePlanTitle';
import { cn } from '@/lib/cn';
import { Flag } from './Flag';
import { ringStateFor, UsageRing } from './UsageRing';

type Action = { key: string; label: string; onPress: () => void };

export type EsimRowProps = {
  esim: Esim;
  onPress: () => void;
  onTopUp?: () => void;
  onBuyAgain?: () => void;
};

export function EsimRow({ esim, onPress, onTopUp, onBuyAgain }: EsimRowProps) {
  const { t, i18n } = useTranslation();
  const esimTitle = useEsimTitle();
  const ended = esim.status === 'expired' || esim.status === 'depleted';
  const state = ringStateFor(esim.data_used_mb, esim.data_total_mb, esim.status);
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const subtitle = ended
    ? t('esims.endedOn', { date: esim.expires_at ? formatShortDate(esim.expires_at, language) : '' })
    : esim.status === 'not_started'
      ? t('esims.notStarted')
      : t('esims.left', { left: formatData(esim.data_total_mb - esim.data_used_mb) });

  const actions: Action[] = [
    { key: 'details', label: t('esims.details'), onPress },
    ...(onTopUp && esim.status === 'active' ? [{ key: 'topUp', label: t('esims.topUp'), onPress: onTopUp }] : []),
  ];
  // No swipe actions: ReanimatedSwipeable drew its action panel above each row instead of
  // behind it. Details and Top up stay reachable as accessibility actions and on the card itself.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${esimTitle(esim)}, ${subtitle}`}
      accessibilityActions={actions.map((action) => ({ name: action.key, label: action.label }))}
      onAccessibilityAction={(event) => actions.find((action) => action.key === event.nativeEvent.actionName)?.onPress()}
      className="min-h-[72px] flex-row items-center gap-3 px-gutter py-3 active:bg-surface-2"
    >
      <Flag code={esim.country_codes[0] ?? ''} size="lg" className={cn(ended && 'opacity-50')} />
      <View className="flex-1 gap-0.5">
        <Text weight="semibold" tone={ended ? 'secondary' : 'primary'} numberOfLines={1}>
          {esimTitle(esim)}
        </Text>
        <Text variant="caption" tone={state === 'low' ? 'warning' : 'tertiary'} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {ended && onBuyAgain ? (
        <Button label={t('esims.buyAgain')} size="sm" pill variant="secondary" onPress={onBuyAgain} />
      ) : (
        <>
          <UsageRing usedMb={esim.data_used_mb} totalMb={esim.data_total_mb} state={state} size="sm" />
          <Icon name="chevronForward" size={13} tone="quaternary" weight="semibold" />
        </>
      )}
    </Pressable>
  );
}
