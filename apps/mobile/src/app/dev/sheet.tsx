import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useDemoPayment } from '@/components/sections/dev/PaymentShowcase';
import { Card, Pill, Sheet, Skeleton, SwipeToPay, Text } from '@/components/ui';

export default function DevSheetScreen() {
  const { t } = useTranslation();
  const payment = useDemoPayment();
  return (
    <Sheet
      title={t('dev.payment.sheetTitle')}
      description={t('dev.payment.sheetBody')}
      onClose={() => router.back()}
      footer={
        <SwipeToPay
          label={t('dev.payment.swipe')}
          amount={t('dev.payment.amount')}
          successLabel={t('dev.payment.paid')}
          status={payment.status}
          onComplete={payment.start}
        />
      }
    >
      <Card padding="lg" className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="title">{t('dev.payment.summary')}</Text>
          <Pill label={t('dev.pills.best')} tone="accent" caps size="sm" />
        </View>
        <Text variant="data-md">{t('dev.payment.amount')}</Text>
      </Card>
      <Skeleton className="h-14 w-full rounded-card" />
      <Skeleton className="h-14 w-full rounded-card" />
    </Sheet>
  );
}
