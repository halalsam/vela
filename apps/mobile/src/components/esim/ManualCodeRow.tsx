import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Text } from '@/components/ui';
import { useCopy } from '@/hooks/useCopy';
import { reducedFadeIn } from '@/lib/motion';

export type ManualCodeRowProps = {
  label: string;
  value: string;
};

export function ManualCodeRow({ label, value }: ManualCodeRowProps) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  return (
    <View className="min-h-14 flex-row items-center gap-3 px-gutter py-3">
      <View className="flex-1 gap-0.5">
        <Text variant="caption" tone="tertiary">
          {label}
        </Text>
        <Text weight="medium" numberOfLines={1} ellipsizeMode="middle" selectable className="tracking-wide">
          {value}
        </Text>
      </View>
      <Animated.View key={copied ? 'copied' : 'copy'} entering={reducedFadeIn}>
        <Button
          label={copied ? t('esim.copied') : t('esim.copy')}
          icon={copied ? 'check' : 'copy'}
          size="sm"
          pill
          variant={copied ? 'primary' : 'secondary'}
          haptic={false}
          accessibilityHint={label}
          onPress={() => void copy(value)}
        />
      </Animated.View>
    </View>
  );
}
