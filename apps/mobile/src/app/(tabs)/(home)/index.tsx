import { useQueryClient } from '@tanstack/react-query';
import { colors } from '@vela/tokens';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';
import {
  ExploreGridSection,
  HomeAlerts,
  MyTravelSection,
  OffersSection,
  SearchPill,
} from '@/components/sections/home/HomeSections';
import { OfflineBanner } from '@/components/sections/states/StateViews';
import { haptics } from '@/lib/haptics';

function greetingKey(hour: number) {
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    haptics.tick();
    await client.refetchQueries({ type: 'active' });
    setRefreshing(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-8 px-gutter pb-16 pt-2"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent.DEFAULT} />}
    >
      <Stack.Screen options={{ title: t(greetingKey(new Date().getHours())) }} />
      <SearchPill />
      <OfflineBanner />
      <HomeAlerts />
      <OffersSection />
      <MyTravelSection />
      <ExploreGridSection />
    </ScrollView>
  );
}
