import type { OrderSummary } from '@vela/api';
import { formatPrice, formatShortDate } from '@vela/utils';
import { Stack } from 'expo-router';
import type { TFunction } from 'i18next';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { EmptyState, ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { ListGroup, ListRow, toast } from '@/components/ui';
import i18n from '@/i18n';
import { api, usingLiveCatalog } from '@/lib/api';
import { useOrders } from '@/queries';

function invoiceLine(order: OrderSummary, t: TFunction): string {
  if (order.invoice_number) return t('invoices.invoice', { number: order.invoice_number });
  if (order.currency !== 'INR') return t('invoices.noInvoice', { currency: order.currency });
  return t('invoices.notReady');
}

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useOrders();
  const [opening, setOpening] = useState<string | null>(null);
  const language = i18n.language === 'ar' ? 'ar' : 'en';

  async function open(order: OrderSummary) {
    if (!order.invoice_number || opening) return;
    if (!usingLiveCatalog) {
      toast.show({ message: t('invoices.demo') });
      return;
    }
    setOpening(order.order_id);
    try {
      const link = await api.getInvoice(order.order_id);
      await WebBrowser.openBrowserAsync(link.url);
    } catch {
      toast.show({ message: t('invoices.failed'), tone: 'danger' });
    } finally {
      setOpening(null);
    }
  }

  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-section px-gutter pb-16 pt-2">
      <Stack.Screen options={{ title: t('invoices.title') }} />
      <OfflineBanner />
      {isPending ? (
        <RowsSkeleton rows={4} />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon="qr" title={t('invoices.emptyTitle')} body={t('invoices.emptyBody')} />
      ) : (
        <ListGroup>
          {data.map((order) => (
            <ListRow
              key={order.order_id}
              title={`${order.number} · ${order.kind === 'top_up' ? t('invoices.topUp') : t('invoices.esim')}`}
              subtitle={`${formatShortDate(order.created_at, language)} · ${order.status === 'refunded' ? t('invoices.refunded') : invoiceLine(order, t)}`}
              value={formatPrice(order.total, order.currency)}
              chevron={Boolean(order.invoice_number)}
              disabled={opening === order.order_id}
              onPress={order.invoice_number ? () => void open(order) : undefined}
            />
          ))}
        </ListGroup>
      )}
    </ScrollView>
  );
}
