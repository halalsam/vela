import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, SectionList, View } from 'react-native';
import type { Country } from '@vela/api';
import { CountryGroupList, GlobalCard, RegionList } from '@/components/sections/explore/ExploreSections';
import { groupCountries, matches } from '@/components/sections/explore/destinations';
import { EmptyState, ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { Input, SectionIndex, Tabs, Text } from '@/components/ui';
import { useLocalized } from '@/i18n/useLocalized';
import { useCountries, useRegions } from '@/queries';

type Mode = 'countries' | 'regions' | 'global';
const modes: readonly Mode[] = ['countries', 'regions', 'global'];

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const localized = useLocalized();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode && modes.includes(params.mode) ? params.mode : 'countries');
  const [query, setQuery] = useState('');
  const countries = useCountries();
  const regions = useRegions();
  const listRef = useRef<SectionList<Country[]>>(null);
  const language = i18n.language === 'ar' ? 'ar' : 'en';

  const groups = useMemo(
    () =>
      groupCountries(
        (countries.data ?? []).filter((country) => matches(query, country.name.en, country.name.ar, country.code)),
        localized,
        language,
      ),
    [countries.data, query, localized, language],
  );
  const filteredRegions = (regions.data ?? []).filter(
    (region) => region.id !== 'global' && matches(query, region.name.en, region.name.ar),
  );
  const global = regions.data?.find((region) => region.id === 'global');

  const header = (
    <View className="gap-4 pb-4">
      <Stack.Screen options={{ title: t('screens.explore') }} />
      <Tabs
        accessibilityLabel={t('explore.tabsLabel')}
        value={mode}
        onChange={setMode}
        items={modes.map((key) => ({ key, label: t(`explore.${key}`) }))}
      />
      {mode !== 'global' ? (
        <Input variant="search" placeholder={t('explore.searchPlaceholder')} value={query} onChangeText={setQuery} returnKeyType="search" />
      ) : null}
      <OfflineBanner />
    </View>
  );

  if (mode === 'countries') {
    const status = countries.isPending ? <RowsSkeleton rows={6} /> : countries.isError ? <ErrorState onRetry={() => void countries.refetch()} /> : null;
    return (
      <View className="flex-1 bg-canvas">
        <SectionList
          ref={listRef}
          sections={status ? [] : groups}
          keyExtractor={(item) => item.map((country) => country.code).join('-')}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          className="flex-1"
          contentContainerClassName="px-gutter pb-36 pe-8"
          ListHeaderComponent={header}
          ListEmptyComponent={
            status ?? <EmptyState icon="search" title={t('explore.noResultsTitle')} body={t('explore.noResultsBody')} />
          }
          renderSectionHeader={({ section }) => (
            <Text variant="label" tone="tertiary" className="px-gutter pb-2 pt-4">
              {section.letter}
            </Text>
          )}
          renderItem={({ item }) => <CountryGroupList countries={item} />}
          onScrollToIndexFailed={() => undefined}
        />
        {groups.length > 1 && !status ? (
          <SectionIndex
            letters={groups.map((group) => group.letter)}
            onSelect={(index) => listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: 40, animated: false })}
            className="absolute bottom-24 right-0.5 top-56 justify-center"
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      contentContainerClassName="px-gutter pb-36"
    >
      {header}
      {regions.isPending ? (
        <RowsSkeleton rows={4} />
      ) : regions.isError ? (
        <ErrorState onRetry={() => void regions.refetch()} />
      ) : mode === 'regions' ? (
        filteredRegions.length > 0 ? (
          <RegionList regions={filteredRegions} />
        ) : (
          <EmptyState icon="search" title={t('explore.noResultsTitle')} body={t('explore.noResultsBody')} />
        )
      ) : global ? (
        <GlobalCard region={global} />
      ) : (
        <EmptyState icon="globe" title={t('explore.noResultsTitle')} />
      )}
    </ScrollView>
  );
}
