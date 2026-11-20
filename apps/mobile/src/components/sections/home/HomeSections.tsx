import type { Esim } from '@vela/api';
import { formatData, formatPrice, isLowData } from '@vela/utils';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ActiveEsimCard, Flag, OfferStrip, RegionRow } from '@/components/esim';
import { Banner, Card, Icon, ListGroup, ListRow, Skeleton, Text } from '@/components/ui';
import { useCountryName } from '@/hooks/useCountryName';
import { useStaggerIn } from '@/hooks/useStaggerIn';
import { useLocalized } from '@/i18n/useLocalized';
import { useCountries, useEsims, useOffers, useRegions } from '@/queries';
import { SectionHeader } from '../SectionHeader';
import { CardSkeleton, EmptyState, ErrorState } from '../states/StateViews';

export function SearchPill() {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={t('home.search')}
      onPress={() => router.push('/search')}
      className="h-12 flex-row items-center gap-3 rounded-pill border border-line bg-surface-1 px-4 active:border-line-strong"
    >
      <Icon name="search" size={16} tone="tertiary" />
      <Text tone="tertiary">{t('home.search')}</Text>
    </Pressable>
  );
}

export function HomeAlerts() {
  const { t } = useTranslation();
  const countryName = useCountryName();
  const { data } = useEsims();
  const low = data?.find((esim) => esim.status === 'active' && isLowData(esim.data_used_mb, esim.data_total_mb));
  if (low) {
    return (
      <Banner
        tone="warning"
        title={t('home.lowTitle', { country: countryName(low.country_codes[0]) })}
        body={t('home.lowBody', { left: formatData(low.data_total_mb - low.data_used_mb) })}
        action={{ label: t('esims.topUp'), onPress: () => router.push({ pathname: '/top-up', params: { iccid: low.iccid } }) }}
      />
    );
  }
  return null;
}

export function OffersSection() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useOffers();
  if (isError || (data && data.length === 0)) return null;
  return (
    <View>
      <SectionHeader title={t('home.offers')} />
      {isPending ? (
        <View className="flex-row gap-card-gap">
          <Skeleton className="h-44 w-[280px] rounded-card" />
          <Skeleton className="h-44 w-16 rounded-card" />
        </View>
      ) : (
        <OfferStrip
          offers={data}
          onPressOffer={(offer) => {
            const code = offer.country_codes[0];
            router.push(code ? { pathname: '/country/[code]', params: { code } } : '/explore');
          }}
        />
      )}
    </View>
  );
}

function TravelCard({ esim, index }: { esim: Esim; index: number }) {
  const entering = useStaggerIn(index);
  return (
    <Animated.View entering={entering}>
      <ActiveEsimCard
        esim={esim}
        onPress={() => router.push({ pathname: '/usage/[iccid]', params: { iccid: esim.iccid } })}
        onTopUp={() => router.push({ pathname: '/top-up', params: { iccid: esim.iccid } })}
      />
    </Animated.View>
  );
}

export function MyTravelSection() {
  const { t } = useTranslation();
  const countryName = useCountryName();
  const { data, isPending, isError, refetch } = useEsims();
  const live = (data ?? []).filter((esim) => esim.status === 'active' || esim.status === 'not_started');
  const ended = (data ?? []).filter((esim) => esim.status === 'expired' || esim.status === 'depleted').slice(0, 2);

  return (
    <View className="gap-card-gap">
      <SectionHeader
        title={t('home.myTravel')}
        action={live.length > 0 ? { label: t('common.seeAll'), onPress: () => router.push('/esims') } : undefined}
      />
      {isPending ? (
        <CardSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : live.length === 0 && ended.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={t('home.noTripsTitle')}
            body={t('home.noTripsBody')}
            action={{ label: t('home.noTripsAction'), onPress: () => router.push('/explore') }}
          />
        </Card>
      ) : (
        <>
          {live.map((esim, index) => (
            <TravelCard key={esim.iccid} esim={esim} index={index} />
          ))}
          {ended.length > 0 ? (
            <ListGroup>
              {ended.map((esim) => {
                const code = esim.country_codes[0] ?? '';
                return (
                  <ListRow
                    key={esim.iccid}
                    leading={<Flag code={code} />}
                    title={t('home.expiredTitle', { country: countryName(code) })}
                    subtitle={t('home.expiredBody')}
                    trailing={<Text variant="callout" weight="semibold">{t('home.buyAgain')}</Text>}
                    chevron={false}
                    onPress={() => router.push({ pathname: '/country/[code]', params: { code } })}
                  />
                );
              })}
            </ListGroup>
          ) : null}
        </>
      )}
    </View>
  );
}

export function ExploreGridSection() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const countries = useCountries();
  const regions = useRegions();
  const popular = (countries.data ?? []).filter((country) => country.popular).slice(0, 6);

  return (
    <View className="gap-card-gap">
      <SectionHeader title={t('home.explore')} action={{ label: t('common.seeAll'), onPress: () => router.push('/explore') }} />
      {countries.isPending ? (
        <View className="flex-row flex-wrap gap-card-gap">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-[48%] rounded-card" />
          ))}
        </View>
      ) : countries.isError ? (
        <ErrorState onRetry={() => void countries.refetch()} />
      ) : (
        <View className="flex-row flex-wrap justify-between gap-y-card-gap">
          {popular.map((country) => (
            <Card
              key={country.code}
              padding="md"
              className="w-[48%] gap-4"
              accessibilityLabel={localized(country.name)}
              onPress={() => router.push({ pathname: '/country/[code]', params: { code: country.code } })}
            >
              <Flag code={country.code} size="xl" />
              <View className="gap-0.5">
                <Text weight="semibold" numberOfLines={1}>
                  {localized(country.name)}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {t('esim.from', { price: formatPrice(country.from_price, country.currency) })}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
      {regions.data && regions.data.length > 0 ? (
        <ListGroup header={t('home.regions')}>
          {regions.data.slice(0, 3).map((region) => (
            <RegionRow key={region.id} region={region} onPress={() => router.push({ pathname: '/explore', params: { mode: 'regions' } })} />
          ))}
        </ListGroup>
      ) : null}
    </View>
  );
}
