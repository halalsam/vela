import { VelaLockup, VelaSymbol } from '@vela/brand/native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export function BrandCheckSection() {
  const { t } = useTranslation();
  return (
    <View className="gap-4 rounded-card border border-line bg-surface-1 p-section">
      <View className="flex-row items-center justify-between">
        <VelaLockup size={28} className="text-fg" />
        <VelaSymbol size={24} className="text-accent" />
      </View>
      <Text className="font-sans-semibold text-label uppercase text-fg-tertiary">{t('brandCheck.label')}</Text>
      <Text className="font-display text-display-lg text-fg">{t('brandCheck.display')}</Text>
      <Text className="font-sans text-body text-fg-secondary">{t('brandCheck.body')}</Text>
      <Text className="font-sans-light text-data-xl tabular-nums text-fg">{t('brandCheck.data')}</Text>
      <Text className="font-arabic text-title text-fg">{t('brandCheck.arabic')}</Text>
    </View>
  );
}
