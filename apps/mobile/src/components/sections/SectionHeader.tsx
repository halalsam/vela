import { Pressable, View } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="min-h-tap flex-row items-center justify-between">
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={12}
          onPress={() => {
            haptics.tap();
            action.onPress();
          }}
          className="flex-row items-center gap-1 active:opacity-60"
        >
          <Text variant="callout" tone="secondary" weight="medium">
            {action.label}
          </Text>
          <Icon name="chevronForward" size={12} tone="tertiary" />
        </Pressable>
      ) : null}
    </View>
  );
}
