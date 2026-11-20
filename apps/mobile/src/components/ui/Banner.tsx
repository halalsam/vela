import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { cn } from '@/lib/cn';
import type { IconName } from '@/lib/icons';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';
import type { Tone } from './tone';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

export type BannerProps = {
  title: string;
  body?: string;
  tone?: BannerTone;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  className?: string;
};

const iconByTone: Record<BannerTone, IconName> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'warning',
  danger: 'error',
};

const tileByTone: Record<BannerTone, string> = {
  info: 'bg-surface-3',
  success: 'bg-success-tint',
  warning: 'bg-warning-tint',
  danger: 'bg-danger-tint',
};

const iconTone: Record<BannerTone, Tone> = {
  info: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function Banner({ title, body, tone = 'info', icon, action, onDismiss, className }: BannerProps) {
  const { t } = useTranslation();
  const urgent = tone === 'warning' || tone === 'danger';
  return (
    <View
      accessibilityRole={urgent ? 'alert' : 'summary'}
      accessibilityLiveRegion={urgent ? 'polite' : 'none'}
      className={cn(
        'flex-row items-center gap-3 rounded-card border border-line border-t-line-highlight bg-surface-2 py-3 ps-3',
        onDismiss ? 'pe-1' : 'pe-3',
        className,
      )}
    >
      <View className={cn('h-10 w-10 items-center justify-center rounded-button', tileByTone[tone])}>
        <Icon name={icon ?? iconByTone[tone]} size={18} tone={iconTone[tone]} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="callout" weight="semibold">
          {title}
        </Text>
        {body ? (
          <Text variant="caption" tone="secondary">
            {body}
          </Text>
        ) : null}
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} size="sm" pill /> : null}
      {onDismiss ? (
        <IconButton icon="close" variant="ghost" size="sm" accessibilityLabel={t('ui.dismiss')} onPress={onDismiss} />
      ) : null}
    </View>
  );
}
