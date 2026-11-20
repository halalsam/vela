import { View } from 'react-native';
import { cn } from '@/lib/cn';
import type { IconName } from '@/lib/icons';
import { Icon } from './Icon';
import { Text } from './Text';
import { statusDot, statusTextTone, statusTint, type StatusTone } from './tone';

export type PillProps = {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  caps?: boolean;
  icon?: IconName;
  size?: 'md' | 'sm';
  className?: string;
};

export function Pill({ label, tone = 'neutral', dot = false, caps = false, icon, size = 'md', className }: PillProps) {
  const textTone = statusTextTone[tone];
  return (
    <View
      className={cn(
        'flex-row items-center self-start rounded-pill',
        size === 'md' ? 'h-7 gap-1.5 px-2.5' : 'h-5 gap-1 px-2',
        statusTint[tone],
        className,
      )}
    >
      {dot ? <View className={cn('h-1.5 w-1.5 rounded-pill', statusDot[tone])} /> : null}
      {icon ? <Icon name={icon} size={size === 'md' ? 12 : 10} tone={textTone} weight="semibold" /> : null}
      <Text variant={caps ? 'label-sm' : 'caption'} weight="semibold" tone={textTone} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
