import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { VelaSplash } from '@/components/esim';
import { ProcessingSteps } from '@/components/sections/purchase/PurchaseSections';
import { ErrorState } from '@/components/sections/states/StateViews';
import { Button, Text } from '@/components/ui';
import { useEsim } from '@/queries';

export default function ProcessingScreen() {
  const { t } = useTranslation();
  const { iccid, orderId } = useLocalSearchParams<{ iccid: string; orderId: string }>();
  const esim = useEsim(iccid);
  const finish = useCallback(() => {
    router.replace({ pathname: '/success', params: { iccid, orderId } });
  }, [iccid, orderId]);

  return (
    <View className="flex-1 justify-center gap-10 bg-canvas px-section pb-safe pt-safe">
      {esim.isError ? (
        <View className="gap-4">
          <ErrorState title={t('processing.failedTitle')} body={t('processing.failedBody')} onRetry={() => void esim.refetch()} />
          <Button label={t('processing.support')} variant="ghost" fullWidth onPress={() => router.replace('/support')} />
        </View>
      ) : (
        <>
          <VelaSplash mode="loop" markHeight={96} accessibilityLabel={t('esim.processing')} className="h-44" />
          <Text variant="display-xl" align="center">
            {t('processing.title')}
          </Text>
          {esim.data ? <ProcessingSteps onDone={finish} /> : <View className="h-24" />}
        </>
      )}
    </View>
  );
}
