import { Link, Stack, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, Text } from '@/components/ui';

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

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-card-gap px-gutter pb-12 pt-section"
    >
      <Stack.Screen options={{ title: t(titleKey) }} />
      {showTitleInContent ? <Text variant="display-xl">{t(titleKey)}</Text> : null}
      {children}
      <Text variant="callout" tone="secondary">
        {t('placeholder.body')}
      </Text>
      <View className="gap-card-gap">
        {links.map((link) => (
          <Link key={`${String(link.href)}-${link.labelKey}`} href={link.href} replace={link.replace} dismissTo={link.dismissTo} asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-tap flex-row items-center gap-3 rounded-card border border-line border-t-line-highlight bg-surface-1 px-gutter py-4 active:border-line-strong"
            >
              <Text variant="label" tone="tertiary">
                {t('placeholder.next')}
              </Text>
              <Text weight="medium" className="flex-1">
                {t(link.labelKey)}
              </Text>
              <Icon name="chevronForward" size={13} tone="quaternary" weight="semibold" />
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}
