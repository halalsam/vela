import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { Icon, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { reducedFadeIn } from '@/lib/motion';

export type InstallStepState = 'upcoming' | 'current' | 'done';

export type InstallStepProps = {
  number: number;
  title: string;
  body?: string;
  state?: InstallStepState;
  last?: boolean;
  children?: ReactNode;
};

const badge: Record<InstallStepState, string> = {
  upcoming: 'border border-line bg-transparent',
  current: 'bg-fg',
  done: 'bg-success-tint',
};

export function InstallStep({ number, title, body, state = 'upcoming', last = false, children }: InstallStepProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const stateLabel = state === 'done' ? t('esim.stepDone') : undefined;
  return (
    <View
      accessible
      accessibilityLabel={[t('esim.step', { number }), title, body, stateLabel].filter(Boolean).join(', ')}
      className="flex-row gap-4"
    >
      <View className="items-center">
        <View className={cn('h-9 w-9 items-center justify-center rounded-pill', badge[state])}>
          {state === 'done' ? (
            <Animated.View entering={reduceMotion ? reducedFadeIn : ZoomIn.springify()}>
              <Icon name="check" size={15} tone="success" weight="bold" />
            </Animated.View>
          ) : (
            <Text variant="callout" weight="semibold" tone={state === 'current' ? 'inverse' : 'tertiary'}>
              {number}
            </Text>
          )}
        </View>
        {last ? null : <View className={cn('mt-2 w-px flex-1', state === 'done' ? 'bg-success/40' : 'bg-line-strong')} />}
      </View>
      <View className={cn('flex-1 gap-1', last ? 'pb-0' : 'pb-8')}>
        <Text variant="title" tone={state === 'upcoming' ? 'secondary' : 'primary'}>
          {title}
        </Text>
        {body ? (
          <Text variant="callout" tone="secondary">
            {body}
          </Text>
        ) : null}
        {children ? <View className="mt-3">{children}</View> : null}
      </View>
    </View>
  );
}
