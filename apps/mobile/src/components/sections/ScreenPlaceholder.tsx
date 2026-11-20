import { Link, Stack, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useDirection } from '@/i18n/useDirection';

export type PlaceholderLink = {
  href: Href;
  labelKey: string;
  replace?: boolean;
  dismissTo?: boolean;
};

type ScreenPlaceholderProps = {
  titleKey: string;
  links?: PlaceholderLink[];
  showTitleInContent?: boolean;
  children?: ReactNode;
};

export function ScreenPlaceholder({ titleKey, links = [], showTitleInContent = false, children }: ScreenPlaceholderProps) {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const displayFont = isRTL ? 'font-arabic-light' : 'font-display';
  const bodyFont = isRTL ? 'font-arabic' : 'font-sans';
  const labelFont = isRTL ? 'font-arabic-semibold' : 'font-sans-semibold';

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-card-gap px-gutter pb-12 pt-section"
    >
      <Stack.Screen options={{ title: t(titleKey) }} />
      {showTitleInContent ? (
        <Text className={`${displayFont} text-display-xl text-fg text-start`}>{t(titleKey)}</Text>
      ) : null}
      {children}
      <Text className={`${bodyFont} text-callout text-fg-secondary text-start`}>{t('placeholder.body')}</Text>
      <View className="gap-card-gap">
        {links.map((link) => (
          <Link key={`${String(link.href)}-${link.labelKey}`} href={link.href} replace={link.replace} dismissTo={link.dismissTo} asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-tap flex-row items-center justify-between rounded-card border border-line bg-surface-1 px-gutter py-4 active:border-line-strong"
            >
              <Text className={`${labelFont} text-label uppercase text-fg-tertiary`}>{t('placeholder.next')}</Text>
              <Text className={`${bodyFont} text-body text-fg`}>{t(link.labelKey)}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}
