import type { Esim } from '@vela/api';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { EsimRow } from '@/components/esim';
import { EmptyState, ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { IconButton, ListGroup } from '@/components/ui';
import { useEsims } from '@/queries';

function Group({ title, esims }: { title: string; esims: Esim[] }) {
  if (esims.length === 0) return null;
  return (
    <ListGroup header={title}>
      {esims.map((esim) => (
        <EsimRow
          key={esim.iccid}
          esim={esim}
          onPress={() => router.push({ pathname: '/usage/[iccid]', params: { iccid: esim.iccid } })}
          onTopUp={() => router.push({ pathname: '/top-up', params: { iccid: esim.iccid } })}
          onBuyAgain={() => {
            const code = esim.country_codes.length === 1 ? esim.country_codes[0] : esim.plan_id.split('-')[0];
            if (code) router.push({ pathname: '/country/[code]', params: { code } });
          }}
        />
      ))}
    </ListGroup>
  );
}

export default function EsimsScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useEsims();
  const esims = data ?? [];

  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-6 px-gutter pb-16 pt-2">
      <Stack.Screen
        options={{
          title: t('screens.esims'),
          headerRight: () => (
            <IconButton icon="plus" variant="ghost" accessibilityLabel={t('esims.add')} onPress={() => router.push('/explore')} />
          ),
        }}
      />
      <OfflineBanner />
      {isPending ? (
        <RowsSkeleton rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : esims.length === 0 ? (
        <EmptyState
          icon="sim"
          title={t('esims.emptyTitle')}
          body={t('esims.emptyBody')}
          action={{ label: t('esims.emptyAction'), onPress: () => router.push('/explore') }}
        />
      ) : (
        <>
          <Group title={t('esims.active')} esims={esims.filter((esim) => esim.status === 'active')} />
          <Group title={t('esims.ready')} esims={esims.filter((esim) => esim.status === 'not_started')} />
          <Group title={t('esims.expired')} esims={esims.filter((esim) => esim.status === 'expired' || esim.status === 'depleted')} />
        </>
      )}
    </ScrollView>
  );
}
