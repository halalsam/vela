import { VelaLockup, VelaSymbol } from '@vela/brand/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card, Text } from '@/components/ui';

export function BrandCheckSection() {
  const { t } = useTranslation();
  return (
    <Card padding="lg" className="gap-4">
      <View className="flex-row items-center justify-between">
        <VelaLockup size={28} className="text-fg" />
        <VelaSymbol size={24} className="text-accent" />
      </View>
      <Text variant="label" tone="tertiary">
        {t('brandCheck.label')}
      </Text>
      <Text variant="display-lg">{t('brandCheck.display')}</Text>
      <Text tone="secondary">{t('brandCheck.body')}</Text>
      <Text variant="data-xl">{t('brandCheck.data')}</Text>
      <Text variant="title" className="font-arabic">
        {t('brandCheck.arabic')}
      </Text>
    </Card>
  );
}
