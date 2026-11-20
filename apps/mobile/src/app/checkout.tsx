import { priceBreakdown, type Coupon } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { CouponField, OrderSummary, Totals } from '@/components/sections/checkout/CheckoutSections';
import { ErrorState, OfflineBanner } from '@/components/sections/states/StateViews';
import { Banner, Button, Sheet, Skeleton, SwipeToPay, toast, type SwipeToPayStatus } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useOnline } from '@/lib/useOnline';
import { useCreateOrder, usePlan, useRedeemCoupon } from '@/queries';

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const plan = usePlan(planId);
  const online = useOnline();
  const redeem = useRedeemCoupon();
  const createOrder = useCreateOrder();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [status, setStatus] = useState<SwipeToPayStatus>('idle');
  const [failed, setFailed] = useState(false);

  const breakdown = plan.data ? priceBreakdown(plan.data.price, coupon) : null;

  function pay() {
    if (!plan.data) return;
    setFailed(false);
    setStatus('loading');
    createOrder.mutate(
      { planId: plan.data.id, couponCode: coupon?.code ?? null },
      {
        onSuccess: (order) => {
          setStatus('success');
          haptics.success();
          setTimeout(() => {
            router.dismiss();
            router.push({ pathname: '/processing', params: { iccid: order.iccid, orderId: order.order_id } });
          }, 450);
        },
        onError: () => {
          setStatus('idle');
          setFailed(true);
          haptics.error();
        },
      },
    );
  }

  return (
    <Sheet
      title={t('checkout.title')}
      onClose={() => router.back()}
      footer={
        plan.data && breakdown ? (
          <>
            <SwipeToPay
              label={t('checkout.swipe')}
              amount={formatPrice(breakdown.total, plan.data.currency)}
              successLabel={t('checkout.paid')}
              status={status}
              disabled={!online}
              onComplete={pay}
            />
            <Button
              label={t('checkout.otherMethods')}
              variant="ghost"
              fullWidth
              onPress={() => toast.show({ message: t('checkout.otherSoon') })}
            />
          </>
        ) : null
      }
    >
      <OfflineBanner />
      {failed ? <Banner tone="danger" title={t('checkout.failedTitle')} body={t('checkout.failedBody')} /> : null}
      {plan.isPending ? (
        <View className="gap-card-gap">
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-14 w-full rounded-button" />
          <Skeleton className="h-24 w-full rounded-card" />
        </View>
      ) : plan.isError || !plan.data || !breakdown ? (
        <ErrorState onRetry={() => void plan.refetch()} />
      ) : (
        <>
          <OrderSummary plan={plan.data} />
          <CouponField
            applied={coupon}
            busy={redeem.isPending}
            error={couponError}
            onRemove={() => setCoupon(null)}
            onApply={(code) => {
              setCouponError(null);
              redeem.mutate(code, {
                onSuccess: (result) => {
                  haptics.success();
                  setCoupon(result);
                },
                onError: () => {
                  haptics.error();
                  setCouponError(t('checkout.couponInvalid'));
                },
              });
            }}
          />
          <Totals currency={plan.data.currency} {...breakdown} />
        </>
      )}
    </Sheet>
  );
}
