import type { Esim } from '@vela/api';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ActiveEsimCard, EsimRow } from '@/components/esim';
import { SectionHeader } from '@/components/sections/SectionHeader';
import { CardSkeleton, EmptyState, ErrorState, OfflineBanner } from '@/components/sections/states/StateViews';
import { Card, IconButton, ListGroup } from '@/components/ui';
import { useStaggerIn } from '@/hooks/useStaggerIn';
import { useEsims } from '@/queries';

function openUsage(esim: Esim) {
  router.push({ pathname: '/usage/[iccid]', params: { iccid: esim.iccid } });
}

function openTopUp(esim: Esim) {
  router.push({ pathname: '/top-up', params: { iccid: esim.iccid } });
}

function LiveCard({ esim, index }: { esim: Esim; index: number }) {
  const entering = useStaggerIn(index);
  return (
    <Animated.View entering={entering}>
      <ActiveEsimCard
        esim={esim}
        onPress={() => openUsage(esim)}
        onTopUp={() => openTopUp(esim)}
        onSetup={() => router.push({ pathname: '/install', params: { iccid: esim.iccid } })}
      />
    </Animated.View>
  );
}

function LiveSection({ title, esims, offset }: { title: string; esims: Esim[]; offset: number }) {
  if (esims.length === 0) return null;
  return (
    <View className="gap-card-gap">
      <SectionHeader title={title} />
      {esims.map((esim, index) => (
        <LiveCard key={esim.iccid} esim={esim} index={offset + index} />
      ))}
    </View>
  );
}

function EndedSection({ title, esims }: { title: string; esims: Esim[] }) {
  if (esims.length === 0) return null;
  return (
    <View className="gap-card-gap">
      <SectionHeader title={title} />
      <ListGroup>
        {esims.map((esim) => (
          <EsimRow
            key={esim.iccid}
            esim={esim}
            onPress={() => openUsage(esim)}
            onBuyAgain={() => {
              const code = esim.country_codes.length === 1 ? esim.country_codes[0] : esim.plan_id.split('-')[0];
              if (code) router.push({ pathname: '/country/[code]', params: { code } });
            }}
          />
        ))}
      </ListGroup>
    </View>
  );
}

export default function EsimsScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useEsims();
  const esims = data ?? [];
  const active = esims.filter((esim) => esim.status === 'active');
  const ready = esims.filter((esim) => esim.status === 'not_started');
  const ended = esims.filter((esim) => esim.status === 'expired' || esim.status === 'depleted');

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-8 px-gutter pb-36 pt-2"
    >
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
        <View className="gap-card-gap">
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : esims.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon="sim"
            title={t('esims.emptyTitle')}
            body={t('esims.emptyBody')}
            action={{ label: t('esims.emptyAction'), onPress: () => router.push('/explore') }}
          />
        </Card>
      ) : (
        <>
          <LiveSection title={t('esims.active')} esims={active} offset={0} />
          <LiveSection title={t('esims.ready')} esims={ready} offset={active.length} />
          <EndedSection title={t('esims.expired')} esims={ended} />
        </>
      )}
    </ScrollView>
  );
}
