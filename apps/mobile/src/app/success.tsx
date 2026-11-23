import { colors } from '@vela/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { QrCard, QrHint, SignalRipple, VelaSplash } from '@/components/esim';
import { InstallActions } from '@/components/sections/purchase/PurchaseSections';
import { ErrorState } from '@/components/sections/states/StateViews';
import { Button, Skeleton, Text } from '@/components/ui';
import { useEsimTitle } from '@/hooks/usePlanTitle';
import { haptics } from '@/lib/haptics';
import { registerPush } from '@/lib/push';
import { useEsim } from '@/queries';

export default function SuccessScreen() {
  const { t } = useTranslation();

  useEffect(() => {
    void registerPush({ prompt: true });
  }, []);
  const { iccid, orderId = '' } = useLocalSearchParams<{ iccid: string; orderId: string }>();
  const esim = useEsim(iccid);
  const esimTitle = useEsimTitle();
  const [revealed, setRevealed] = useState(false);

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-row justify-end px-gutter pt-safe">
        <Button label={t('common.done')} variant="ghost" onPress={() => router.dismissTo('/')} />
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-section px-section pb-safe-offset-6">
        {esim.isPending ? (
          <Skeleton className="h-[232px] w-[232px] self-center rounded-card-lg" />
        ) : esim.isError || !esim.data ? (
          <ErrorState onRetry={() => void esim.refetch()} />
        ) : (
          <>
            {revealed ? (
              <View className="items-center justify-center">
                <SignalRipple />
                <QrCard value={esim.data.lpa_string} revealed flipOnMount />
              </View>
            ) : (
              <View className="h-[232px] justify-center">
                <VelaSplash
                  mode="build"
                  markHeight={110}
                  color={colors.accent.DEFAULT}
                  onFinish={() => {
                    haptics.success();
                    setRevealed(true);
                  }}
                  className="h-40"
                />
              </View>
            )}
            <View className="items-center gap-2">
              <Text variant="display-xl" align="center" accessibilityRole="header">
                {t('success.title')}
              </Text>
              <Text variant="callout" tone="secondary" align="center">
                {t('success.body', { plan: esimTitle(esim.data), order: orderId })}
              </Text>
            </View>
            <QrHint />
            <InstallActions esim={esim.data} />
            <Button
              label={t('success.guide')}
              variant="secondary"
              fullWidth
              onPress={() => router.replace({ pathname: '/install', params: { iccid: esim.data.iccid } })}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
