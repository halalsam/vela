import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { Platform, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { colors } from '@vela/tokens';
import { PullMark } from '@/components/esim';
import { ExploreGridSection, HomeAlerts, MyTravelSection, OffersSection, SearchPill } from '@/components/sections/home/HomeSections';
import { OfflineBanner } from '@/components/sections/states/StateViews';
import { Text } from '@/components/ui';
import { useScrollY } from '@/hooks/useParallax';
import { useStaggerIn } from '@/hooks/useStaggerIn';
import { haptics } from '@/lib/haptics';

function greetingKey(hour: number) {
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

function Rise({ index, children }: { index: number; children: React.ReactNode }) {
  const entering = useStaggerIn(index, { step: 80 });
  return <Animated.View entering={entering}>{children}</Animated.View>;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { scrollY, onScroll } = useScrollY();
  const insets = useSafeAreaInsets();

  async function refresh() {
    setRefreshing(true);
    haptics.press();
    await client.refetchQueries({ type: 'active' });
    setRefreshing(false);
    haptics.success();
  }

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
        contentContainerClassName="gap-8 px-gutter pb-36"
        contentContainerStyle={{ paddingTop: insets.top + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={Platform.OS === 'ios' ? 'transparent' : colors.accent.DEFAULT}
            colors={[colors.accent.DEFAULT]}
            progressBackgroundColor={colors.surface[2]}
          />
        }
      >
        <Text variant="display-xl" accessibilityRole="header">
          {t(greetingKey(new Date().getHours()))}
        </Text>
        <Rise index={0}>
          <SearchPill />
        </Rise>
        <OfflineBanner />
        <HomeAlerts />
        <Rise index={1}>
          <OffersSection />
        </Rise>
        <Rise index={2}>
          <MyTravelSection />
        </Rise>
        <Rise index={3}>
          <ExploreGridSection />
        </Rise>
      </Animated.ScrollView>
      <PullMark scrollY={scrollY} refreshing={refreshing} />
      {/* Home has no navigation header, so give the status bar its own backdrop. Otherwise cards scroll under the notch. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top }}>
        <BlurView intensity={40} tint="dark" style={{ flex: 1 }} />
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.canvas.DEFAULT, opacity: 0.72 }}
        />
      </View>
    </View>
  );
}
