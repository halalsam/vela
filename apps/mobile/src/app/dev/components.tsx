import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { ActionsShowcase } from '@/components/sections/dev/ActionsShowcase';
import { InputsShowcase } from '@/components/sections/dev/InputsShowcase';
import { NavigationShowcase } from '@/components/sections/dev/NavigationShowcase';
import { PaymentShowcase } from '@/components/sections/dev/PaymentShowcase';
import { StatusShowcase } from '@/components/sections/dev/StatusShowcase';
import { SurfacesShowcase } from '@/components/sections/dev/SurfacesShowcase';
import { TypographyShowcase } from '@/components/sections/dev/TypographyShowcase';

export default function DevComponentsScreen() {
  const { t } = useTranslation();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-12 px-gutter pb-16 pt-section"
    >
      <Stack.Screen options={{ title: t('dev.title') }} />
      <PaymentShowcase />
      <ActionsShowcase />
      <StatusShowcase />
      <SurfacesShowcase />
      <InputsShowcase />
      <NavigationShowcase />
      <TypographyShowcase />
    </ScrollView>
  );
}
