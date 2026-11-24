import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import {
  AccountCard,
  AccountGroup,
  DeveloperGroup,
  HelpGroup,
  PreferencesGroup,
  SignOutRow,
} from '@/components/sections/profile/ProfileSections';
import { OfflineBanner } from '@/components/sections/states/StateViews';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-6 px-gutter pb-36 pt-2">
      <Stack.Screen options={{ title: t('screens.profile') }} />
      <OfflineBanner />
      <AccountCard />
      <PreferencesGroup />
      <AccountGroup />
      <HelpGroup />
      <DeveloperGroup />
      <SignOutRow />
    </ScrollView>
  );
}
