import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { NotifyPage, SailPage, StepsPage } from '@/components/sections/onboarding/OnboardingPages';
import { Button, PageDots } from '@/components/ui';
import { useSession } from '@/stores/session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const pages = ['sail', 'steps', 'notify'] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<(typeof pages)[number]>>(null);
  const [index, setIndex] = useState(0);
  const completeOnboarding = useSession((state) => state.completeOnboarding);
  const last = index === pages.length - 1;

  function goTo(next: number) {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="h-tap flex-row justify-end px-gutter">
        {last ? null : (
          <Button label={t('onboarding.skip')} variant="ghost" size="sm" haptic={false} onPress={() => goTo(pages.length - 1)} />
        )}
      </View>
      <FlatList
        ref={listRef}
        data={pages}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(page) => page}
        getItemLayout={(_, item) => ({ length: width, offset: width * item, index: item })}
        onMomentumScrollEnd={(event) => setIndex(Math.round(Math.abs(event.nativeEvent.contentOffset.x) / width))}
        renderItem={({ item, index: pageIndex }) => (
          <View className="w-screen px-section pb-8">
            {item === 'sail' ? <SailPage active={pageIndex === index} /> : item === 'steps' ? <StepsPage /> : <NotifyPage />}
          </View>
        )}
      />
      <View className="gap-4 px-gutter pb-4">
        <PageDots count={pages.length} index={index} />
        {last ? (
          <>
            <Button label={t('onboarding.allow')} fullWidth onPress={() => completeOnboarding(true)} />
            <Button label={t('onboarding.notNow')} variant="ghost" fullWidth onPress={() => completeOnboarding(false)} />
          </>
        ) : (
          <Button label={t('common.continue')} fullWidth icon="arrowForward" iconPosition="end" onPress={() => goTo(index + 1)} />
        )}
      </View>
    </View>
  );
}
