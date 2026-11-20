import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { CountryGroupList, openDestination, RegionList } from '@/components/sections/explore/ExploreSections';
import { matches } from '@/components/sections/explore/destinations';
import { SectionHeader } from '@/components/sections/SectionHeader';
import { EmptyState, ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { Chip } from '@/components/ui';
import { useLocalized } from '@/i18n/useLocalized';
import { useCountries, useRegions } from '@/queries';

export default function SearchScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const [query, setQuery] = useState('');
  const countries = useCountries();
  const regions = useRegions();
  const trimmed = query.trim();
  const countryHits = (countries.data ?? []).filter((country) => matches(trimmed, country.name.en, country.name.ar, country.code));
  const regionHits = (regions.data ?? []).filter((region) => matches(trimmed, region.name.en, region.name.ar));
  const popular = (countries.data ?? []).filter((country) => country.popular);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-4 px-gutter pb-16 pt-2"
    >
      <Stack.Screen
        options={{
          title: t('screens.search'),
          headerSearchBarOptions: {
            placeholder: t('search.placeholder'),
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
          },
        }}
      />
      <OfflineBanner />
      {countries.isPending ? (
        <RowsSkeleton rows={5} />
      ) : countries.isError ? (
        <ErrorState onRetry={() => void countries.refetch()} />
      ) : !trimmed ? (
        <View>
          <SectionHeader title={t('explore.popular')} />
          <View className="flex-row flex-wrap gap-2">
            {popular.map((country) => (
              <Chip key={country.code} label={localized(country.name)} onPress={() => openDestination(country.code)} />
            ))}
          </View>
        </View>
      ) : countryHits.length + regionHits.length === 0 ? (
        <EmptyState icon="search" title={t('explore.noResultsTitle')} body={t('explore.noResultsBody')} />
      ) : (
        <>
          {countryHits.length > 0 ? <CountryGroupList countries={countryHits} /> : null}
          {regionHits.length > 0 ? <RegionList regions={regionHits} /> : null}
        </>
      )}
    </ScrollView>
  );
}
