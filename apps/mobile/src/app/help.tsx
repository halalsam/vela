import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from '@/components/ui';

const QUESTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export default function HelpScreen() {
  const { t } = useTranslation();
  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-section px-gutter pb-24 pt-2">
      <Stack.Screen options={{ title: t('help.title') }} />
      <Text variant="callout" tone="secondary">
        {t('help.intro')}
      </Text>
      <View className="gap-card-gap">
        {QUESTIONS.map((index) => (
          <Card key={index} className="gap-2">
            <Text weight="semibold" accessibilityRole="header">
              {t(`help.q${index}`)}
            </Text>
            <Text variant="callout" tone="secondary">
              {t(`help.a${index}`)}
            </Text>
          </Card>
        ))}
      </View>
      <View className="gap-3">
        <Text variant="callout" tone="secondary" align="center">
          {t('help.contact')}
        </Text>
        <Button label={t('profile.support')} icon="chat" variant="secondary" fullWidth onPress={() => router.push('/support')} />
      </View>
    </ScrollView>
  );
}
