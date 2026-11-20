import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  DestinationFacts,
  DestinationHero,
  DestinationSkeleton,
  PlanBar,
  PlanPicker,
  type Destination,
} from '@/components/sections/country/DestinationSections';
import { SectionHeader } from '@/components/sections/SectionHeader';
import { EmptyState, ErrorState, OfflineBanner } from '@/components/sections/states/StateViews';
import { useParallax, useScrollY } from '@/hooks/useParallax';
import { useLocalized } from '@/i18n/useLocalized';
import { useCountries, usePlans, useRegionPlans, useRegions } from '@/queries';

export default function DestinationScreen() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const countries = useCountries();
  const regions = useRegions();
  const isRegion = code.length !== 2;
  const countryPlans = usePlans(isRegion ? '' : code.toUpperCase());
  const regionPlans = useRegionPlans(isRegion ? code : undefined);
  const plansQuery = isRegion ? regionPlans : countryPlans;
  const [selected, setSelected] = useState<string>();
  const { scrollY, onScroll } = useScrollY();
  const heroStyle = useParallax(scrollY, { height: 260, factor: 0.35 });

  const country = countries.data?.find((item) => item.code === code.toUpperCase());
  const region = regions.data?.find((item) => item.id === code);
  const destination: Destination | undefined = country
    ? { id: country.code, name: localized(country.name), codes: [country.code], isRegion: false }
    : region
      ? { id: region.id, name: localized(region.name), codes: region.country_codes, isRegion: true }
      : undefined;
  const plans = plansQuery.data ?? [];
  const selectedId = selected ?? plans[1]?.id ?? plans[0]?.id;
  const selectedPlan = plans.find((plan) => plan.id === selectedId);
  const loading = countries.isPending || regions.isPending || plansQuery.isPending;
  const failed = countries.isError || regions.isError || plansQuery.isError;

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ title: '' }} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-section px-gutter pb-40"
      >
        <OfflineBanner />
        {loading ? (
          <DestinationSkeleton />
        ) : failed ? (
          <ErrorState
            className="mt-10"
            onRetry={() => {
              void countries.refetch();
              void regions.refetch();
              void plansQuery.refetch();
            }}
          />
        ) : !destination || plans.length === 0 ? (
          <EmptyState icon="globe" title={t('states.notFoundTitle')} body={t('states.notFoundBody')} />
        ) : (
          <>
            <Animated.View style={heroStyle}>
              <DestinationHero destination={destination} plans={plans} />
            </Animated.View>
            <View>
              <SectionHeader title={t('country.plans')} />
              <PlanPicker
                plans={plans}
                selectedId={selectedId}
                onSelect={setSelected}
                label={t('country.plansLabel', { country: destination.name })}
              />
            </View>
            <DestinationFacts plan={selectedPlan} />
          </>
        )}
      </Animated.ScrollView>
      {!loading && !failed && destination ? (
        <PlanBar
          plan={selectedPlan}
          onContinue={() => selectedPlan && router.push({ pathname: '/checkout', params: { planId: selectedPlan.id } })}
        />
      ) : null}
    </View>
  );
}
