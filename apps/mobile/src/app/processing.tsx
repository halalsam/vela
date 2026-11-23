import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { VelaSplash } from '@/components/esim';
import { ProcessingSteps } from '@/components/sections/purchase/PurchaseSections';
import { ErrorState } from '@/components/sections/states/StateViews';
import { Button, Text } from '@/components/ui';
import { useEsim, useOrder } from '@/queries';

const SLOW_AFTER_MS = 60_000;

export default function ProcessingScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ iccid?: string; orderId: string }>();
  const known = params.iccid ? params.iccid : undefined;
  const order = useOrder(params.orderId, !known);
  const iccid = known ?? order.data?.iccid ?? undefined;
  const esim = useEsim(iccid);
  const refunded = order.data?.status === 'provisioning_failed' || order.data?.status === 'refunded';
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (iccid) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [iccid]);

  const finish = useCallback(() => {
    if (iccid) router.replace({ pathname: '/success', params: { iccid, orderId: params.orderId } });
  }, [iccid, params.orderId]);

  if (refunded) {
    return (
      <View className="flex-1 justify-center gap-4 bg-canvas px-section pb-safe pt-safe">
        <ErrorState title={t('processing.refundedTitle')} body={t('processing.refundedBody')} />
        <Button label={t('processing.support')} variant="ghost" fullWidth onPress={() => router.replace('/support')} />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center gap-10 bg-canvas px-section pb-safe pt-safe">
      {esim.isError || order.isError ? (
        <View className="gap-4">
          <ErrorState
            title={t('processing.failedTitle')}
            body={t('processing.failedBody')}
            onRetry={() => void (esim.isError ? esim.refetch() : order.refetch())}
          />
          <Button label={t('processing.support')} variant="ghost" fullWidth onPress={() => router.replace('/support')} />
        </View>
      ) : (
        <>
          <VelaSplash mode="loop" markHeight={96} accessibilityLabel={t('esim.processing')} className="h-44" />
          <Text variant="display-xl" align="center">
            {t('processing.title')}
          </Text>
          {esim.data ? (
            <ProcessingSteps onDone={finish} />
          ) : slow ? (
            <View className="h-24 gap-4">
              <Text variant="callout" tone="secondary" align="center">
                {t('processing.waitingBody')}
              </Text>
              <Button label={t('processing.support')} variant="ghost" fullWidth onPress={() => router.replace('/support')} />
            </View>
          ) : (
            <View className="h-24" />
          )}
        </>
      )}
    </View>
  );
}
