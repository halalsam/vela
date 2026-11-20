import { View } from 'react-native';
import { Button, Text } from '@/components/ui';

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="min-h-tap flex-row items-center justify-between">
      <Text variant="label" tone="tertiary" accessibilityRole="header">
        {title}
      </Text>
      {action ? <Button label={action.label} variant="ghost" size="sm" onPress={action.onPress} className="-me-4" /> : null}
    </View>
  );
}
