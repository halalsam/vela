import { isLowData } from '@vela/utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { UsageRing, ValidityCountdown, ringStateFor } from '@/components/esim';
import { LiveActivityToggle } from '@/components/sections/usage/LiveActivityToggle';
import { UsageBars, UsageDetails } from '@/components/sections/usage/UsageSections';
import { CardSkeleton, ErrorState, OfflineBanner } from '@/components/sections/states/StateViews';
import { Banner, Button, Card } from '@/components/ui';
import { useEsimTitle } from '@/hooks/usePlanTitle';
import { useDailyUsage, useEsim } from '@/queries';

export default function UsageScreen() {
  const { t } = useTranslation();
  const { iccid } = useLocalSearchParams<{ iccid: string }>();
  const esim = useEsim(iccid);
  const usage = useDailyUsage(iccid);
  const esimTitle = useEsimTitle();
  const data = esim.data;
  const ended = data && (data.status === 'expired' || data.status === 'depleted');
  const low = data && data.status === 'active' && isLowData(data.data_used_mb, data.data_total_mb);
  const code = data ? (data.country_codes.length === 1 ? data.country_codes[0] : data.plan_id.split('-')[0]) : undefined;

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ title: data ? esimTitle(data) : t('screens.usage') }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-section px-gutter pb-32 pt-2">
        <OfflineBanner />
        {esim.isPending ? (
          <CardSkeleton />
        ) : esim.isError || !data ? (
          <ErrorState onRetry={() => void esim.refetch()} />
        ) : (
          <>
            {low ? <Banner tone="warning" title={t('usage.lowTitle')} body={t('usage.lowBody')} /> : null}
            {ended ? <Banner tone="danger" title={t('usage.expiredTitle')} body={t('usage.expiredBody')} /> : null}
            {data.status === 'not_started' ? <Banner tone="info" icon="clock" title={t('usage.notStartedTitle')} body={t('usage.notStartedBody')} /> : null}
            <Card padding="lg" className="items-center gap-5">
              <UsageRing
                usedMb={data.data_used_mb}
                totalMb={data.data_total_mb}
                state={ringStateFor(data.data_used_mb, data.data_total_mb, data.status)}
                size="lg"
              />
              <ValidityCountdown expiresAt={data.expires_at} variant="pill" />
            </Card>
            <LiveActivityToggle esim={data} />
            {data.status === 'active' && usage.data ? <UsageBars days={usage.data} /> : null}
            <UsageDetails esim={data} />
          </>
        )}
      </ScrollView>
      {data ? (
        <View className="absolute inset-x-gutter bottom-safe-offset-3">
          {ended ? (
            <Button
              label={t('esims.buyAgain')}
              fullWidth
              onPress={() => code && router.push({ pathname: '/country/[code]', params: { code } })}
            />
          ) : data.status === 'not_started' ? (
            <Button label={t('usage.installGuide')} fullWidth onPress={() => router.push({ pathname: '/install', params: { iccid: data.iccid } })} />
          ) : (
            <Button
              label={t('esims.topUp')}
              icon="plus"
              fullWidth
              onPress={() => router.push({ pathname: '/top-up', params: { iccid: data.iccid } })}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}
