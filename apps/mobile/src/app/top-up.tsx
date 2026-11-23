import { formatData, formatPrice } from '@vela/utils';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Flag, PriceOdometer } from '@/components/esim';
import { TopUpOption } from '@/components/sections/usage/UsageSections';
import { EmptyState, ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { Banner, Card, Sheet, SwipeToPay, Text, toast, type SwipeToPayStatus } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { PaymentCancelled } from '@/lib/payments';
import { useOnline } from '@/lib/useOnline';
import { TopUpPending, useEsim, useTopUp, useTopUpPacks } from '@/queries';

function newAttemptKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function TopUpScreen() {
  const { t } = useTranslation();
  const { iccid } = useLocalSearchParams<{ iccid: string }>();
  const esim = useEsim(iccid);
  const packs = useTopUpPacks(iccid);
  const topUp = useTopUp();
  const online = useOnline();
  const [selected, setSelected] = useState<string>();
  const attempt = useRef(newAttemptKey());
  const [status, setStatus] = useState<SwipeToPayStatus>('idle');
  const [failed, setFailed] = useState(false);
  const list = packs.data ?? [];
  const pack = list.find((item) => item.id === (selected ?? list[1]?.id ?? list[0]?.id));

  function pay() {
    if (!pack) return;
    setFailed(false);
    setStatus('loading');
    topUp.mutate(
      { iccid, packId: pack.id, idempotencyKey: attempt.current, description: t('topUp.paymentDescription', { data: formatData(pack.data_mb) }) },
      {
        onSuccess: () => {
          setStatus('success');
          toast.show({ message: t('topUp.done', { data: formatData(pack.data_mb) }), tone: 'success' });
          setTimeout(() => router.back(), 600);
        },
        onError: (error) => {
          setStatus('idle');
          if (error instanceof PaymentCancelled) return;
          if (error instanceof TopUpPending) {
            toast.show({ message: t('topUp.pending') });
            setTimeout(() => router.back(), 600);
            return;
          }
          setFailed(true);
          haptics.error();
        },
      },
    );
  }

  return (
    <Sheet
      title={t('topUp.title')}
      description={t('topUp.body')}
      onClose={() => router.back()}
      footer={
        pack ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between px-1">
              <Text variant="callout" tone="secondary">
                {t('checkout.total')}
              </Text>
              <PriceOdometer amount={pack.price} currency={pack.currency} variant="data-md" />
            </View>
            <SwipeToPay
              label={t('checkout.swipe')}
              amount={formatPrice(pack.price, pack.currency)}
              successLabel={t('checkout.paid')}
              status={status}
              disabled={!online}
              onComplete={pay}
            />
          </View>
        ) : null
      }
    >
      <OfflineBanner />
      {failed ? <Banner tone="danger" title={t('checkout.failedTitle')} body={t('checkout.failedBody')} /> : null}
      {esim.data ? (
        <Card className="flex-row items-center gap-3">
          <Flag code={esim.data.country_codes[0] ?? ''} />
          <Text weight="medium">{t('topUp.now', { left: formatData(esim.data.data_total_mb - esim.data.data_used_mb) })}</Text>
        </Card>
      ) : null}
      {packs.isPending ? (
        <RowsSkeleton rows={3} />
      ) : packs.isError ? (
        <ErrorState onRetry={() => void packs.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon="plus" title={t('states.notFoundTitle')} />
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('topUp.packsLabel')} className="gap-card-gap">
          {list.map((item) => (
            <TopUpOption key={item.id} pack={item} selected={item.id === pack?.id} onPress={() => {
                setSelected(item.id);
                attempt.current = newAttemptKey();
              }}
            />
          ))}
        </View>
      )}
    </Sheet>
  );
}
