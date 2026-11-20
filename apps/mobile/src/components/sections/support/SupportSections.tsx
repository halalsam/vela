import type { SupportMessage } from '@vela/api';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { reducedFadeIn } from '@/lib/motion';

export type ChatMessage = Pick<SupportMessage, 'id' | 'from' | 'text' | 'install_step'>;

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const mine = message.from === 'user';
  return (
    <Animated.View entering={reducedFadeIn} className={cn('max-w-[82%] gap-2', mine ? 'self-end' : 'self-start')}>
      <View className={cn('rounded-card-lg px-4 py-2.5', mine ? 'bg-fg' : 'border border-line bg-surface-2')}>
        <Text tone={mine ? 'inverse' : 'primary'}>{message.text}</Text>
      </View>
      {message.install_step ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/install')}
          className="flex-row items-center gap-3 rounded-card border border-line bg-surface-1 p-3 active:border-line-strong"
        >
          <View className="h-9 w-9 items-center justify-center rounded-chip bg-fg">
            <Icon name="signal" size={16} tone="inverse" />
          </View>
          <View className="flex-1">
            <Text variant="callout" weight="semibold">
              {t('support.installCard')}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t('support.installCardBody', { step: message.install_step })}
            </Text>
          </View>
          <Icon name="chevronForward" size={12} tone="quaternary" />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function TypingBubble() {
  const { t } = useTranslation();
  return (
    <Animated.View entering={reducedFadeIn} className="self-start rounded-card-lg border border-line bg-surface-2 px-4 py-2.5">
      <Text variant="callout" tone="tertiary" accessibilityLiveRegion="polite">
        {t('support.typing')}
      </Text>
    </Animated.View>
  );
}
