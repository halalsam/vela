import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SwipeToPay, toast, type SwipeToPayStatus } from '@/components/ui';
import { ShowcaseSection } from './ShowcaseSection';

const PROCESSING_MS = 1200;
const RESET_MS = 2000;

export function useDemoPayment() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SwipeToPayStatus>('idle');

  useEffect(() => {
    if (status === 'loading') {
      const timer = setTimeout(() => {
        setStatus('success');
        toast.show({ message: t('dev.banners.paidTitle'), tone: 'success' });
      }, PROCESSING_MS);
      return () => clearTimeout(timer);
    }
    if (status === 'success') {
      const timer = setTimeout(() => setStatus('idle'), RESET_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, t]);

  return { status, start: () => setStatus('loading') };
}

export function PaymentShowcase() {
  const { t } = useTranslation();
  const payment = useDemoPayment();

  return (
    <ShowcaseSection title={t('dev.sections.payment')} note={t('dev.notes.swipe')}>
      <SwipeToPay
        label={t('dev.payment.swipe')}
        amount={t('dev.payment.amount')}
        successLabel={t('dev.payment.paid')}
        status={payment.status}
        onComplete={payment.start}
      />
      <SwipeToPay label={t('dev.payment.swipe')} amount={t('dev.payment.amount')} disabled onComplete={() => undefined} />
      <Button label={t('dev.payment.openSheet')} variant="secondary" fullWidth onPress={() => router.push('/dev/sheet')} />
    </ShowcaseSection>
  );
}
