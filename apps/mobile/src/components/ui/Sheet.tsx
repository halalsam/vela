import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const header = (
    <View className="flex-row items-start gap-3 pb-2">
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
      {onClose ? <IconButton icon="close" size="sm" accessibilityLabel={t('ui.close')} onPress={onClose} /> : null}
    </View>
  );
  // Header stays the first child, above the ScrollView. When the ScrollView was the first
  // child, iOS adopted it as the sheet's tracked scroll view and the body rendered blank.
  // Automatic content insets are off: they shifted the scroll content up over the header.
  return (
    <View className="flex-1 bg-surface-1">
      <View className="px-section pt-6">{header}</View>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentContainerClassName="gap-card-gap px-section pb-6 pt-3"
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 gap-card-gap px-section pt-3">{children}</View>
      )}
      {footer ? (
        <View className="gap-3 border-t border-line px-section pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}
