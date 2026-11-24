import { VelaSymbol } from '@vela/brand/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Banner, Button, Card, Icon, Skeleton, Text } from '@/components/ui';
import type { IconName } from '@/lib/icons';
import { cn } from '@/lib/cn';
import { reducedFadeIn } from '@/lib/motion';
import { useOnline } from '@/lib/useOnline';

export type ErrorStateProps = {
  title?: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ title, body, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={reducedFadeIn} className={className}>
      <Card padding="lg" className="items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-pill bg-danger-tint">
          <Icon name="error" size={20} tone="danger" />
        </View>
        <Text variant="title" align="center" accessibilityRole="alert">
          {title ?? t('states.errorTitle')}
        </Text>
        <Text variant="callout" tone="secondary" align="center">
          {body ?? t('states.errorBody')}
        </Text>
        {onRetry ? <Button label={t('states.retry')} variant="secondary" size="sm" pill icon="arrowForward" onPress={onRetry} className="mt-1 self-center" /> : null}
      </Card>
    </Animated.View>
  );
}

export type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  className?: string;
};

export function EmptyState({ title, body, icon, action, className }: EmptyStateProps) {
  return (
    <Animated.View entering={reducedFadeIn} className={cn('items-center gap-3 px-6 py-10', className)}>
      <View className="mb-2 h-24 w-24 items-center justify-center rounded-pill border border-line bg-surface-1">
        {icon ? <Icon name={icon} size={30} tone="tertiary" /> : <VelaSymbol size={36} className="text-fg-tertiary" />}
      </View>
      <Text variant="display-md" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" tone="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} className="mt-3 self-center" /> : null}
    </Animated.View>
  );
}

export function OfflineBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <Animated.View entering={reducedFadeIn} className={className}>
      <Banner tone="info" icon="offline" title={t('states.offlineTitle')} body={t('states.offlineBody')} />
    </Animated.View>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card padding="none" className="overflow-hidden">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} className={cn('flex-row items-center gap-3 px-gutter py-4', index > 0 && 'border-t border-line')}>
          <Skeleton className="h-7 w-7 rounded-pill" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-1/2 rounded-chip" />
            <Skeleton className="h-3 w-1/3 rounded-chip" />
          </View>
          <Skeleton className="h-3.5 w-14 rounded-chip" />
        </View>
      ))}
    </Card>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card padding="lg" className={cn('gap-5', className)}>
      <View className="flex-row items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-pill" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-1/2 rounded-chip" />
          <Skeleton className="h-3 w-1/3 rounded-chip" />
        </View>
      </View>
      <View className="flex-row items-center gap-5">
        <Skeleton className="h-28 w-28 rounded-pill" />
        <View className="flex-1 gap-3">
          <Skeleton className="h-3.5 w-3/4 rounded-chip" />
          <Skeleton className="h-8 w-1/2 rounded-chip" />
          <Skeleton className="h-10 w-28 rounded-chip" />
        </View>
      </View>
    </Card>
  );
}
