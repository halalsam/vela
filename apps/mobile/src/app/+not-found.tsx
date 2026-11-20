import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { EmptyState } from '@/components/sections/states/StateViews';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center bg-canvas">
      <Stack.Screen options={{ title: '' }} />
      <EmptyState
        title={t('screens.notFound')}
        body={t('states.notFoundBody')}
        action={{ label: t('screens.home'), onPress: () => router.dismissTo('/') }}
      />
    </View>
  );
}
