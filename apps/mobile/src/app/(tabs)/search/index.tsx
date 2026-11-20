import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function SearchScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ headerSearchBarOptions: { placeholder: t('search.placeholder') } }} />
      <ScreenPlaceholder titleKey="screens.search" links={[{ href: '/country/jp', labelKey: 'screens.country' }]} />
    </>
  );
}
