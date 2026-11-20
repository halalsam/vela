import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type SheetProps = {
  title: string;
  description?: string;
  onClose?: () => void;
  footer?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
};

export function Sheet({ title, description, onClose, footer, scroll = true, children }: SheetProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-surface-1">
      <View className="flex-row items-start gap-3 px-section pb-2 pt-6">
        <View className="flex-1 gap-1">
          <Text variant="display-md" accessibilityRole="header">
            {title}
          </Text>
          {description ? (
            <Text variant="callout" tone="secondary">
              {description}
            </Text>
          ) : null}
        </View>
        {onClose ? (
          <IconButton icon="close" size="sm" accessibilityLabel={t('ui.close')} onPress={onClose} />
        ) : null}
      </View>
      {scroll ? (
        <ScrollView className="flex-1" contentContainerClassName="gap-card-gap px-section pb-6 pt-2">
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 gap-card-gap px-section pt-2">{children}</View>
      )}
      {footer ? <View className="gap-3 border-t border-line px-section pb-safe-offset-4 pt-4">{footer}</View> : null}
    </View>
  );
}
