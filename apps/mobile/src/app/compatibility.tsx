import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Card, Text } from '@/components/ui';

const SECTIONS = ['check', 'iphone', 'android', 'unlocked', 'settings'] as const;

export default function CompatibilityScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-section px-gutter pb-24 pt-2">
      <Stack.Screen options={{ title: t('compatibility.title') }} />
      <Text variant="callout" tone="secondary">
        {t('compatibility.intro')}
      </Text>
      <View className="gap-card-gap">
        {SECTIONS.map((key) => (
          <Card key={key} className="gap-2">
            <Text weight="semibold" accessibilityRole="header">
              {t(`compatibility.${key}Title`)}
            </Text>
            <Text variant="callout" tone="secondary">
              {t(`compatibility.${key}Body`)}
            </Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
