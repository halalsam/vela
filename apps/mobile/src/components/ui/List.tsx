import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { Card } from './Card';
import { Icon } from './Icon';
import { Text } from './Text';

export type ListGroupProps = {
  children: ReactNode;
  header?: string;
  footer?: string;
  className?: string;
};

export function ListGroup({ children, header, footer, className }: ListGroupProps) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View className={cn('gap-2', className)}>
      {header ? (
        <Text variant="label" tone="tertiary" className="px-gutter">
          {header}
        </Text>
      ) : null}
      <Card padding="none" className="overflow-hidden">
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View className="ms-gutter h-[0.5px] bg-line-strong" /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
      {footer ? (
        <Text variant="caption" tone="tertiary" className="px-gutter">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  leading?: ReactNode;
  leadingIcon?: IconName;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function ListRow({
  title,
  subtitle,
  value,
  leading,
  leadingIcon,
  trailing,
  chevron,
  onPress,
  destructive = false,
  disabled = false,
  accessibilityHint,
}: ListRowProps) {
  const showChevron = chevron ?? Boolean(onPress);
  const content = (
    <>
      {leadingIcon ? (
        <View className="h-8 w-8 items-center justify-center rounded-chip bg-surface-3">
          <Icon name={leadingIcon} size={15} tone={destructive ? 'danger' : 'primary'} />
        </View>
      ) : null}
      {leading}
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="medium" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" tone="tertiary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="callout" tone="secondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <Icon name="chevronForward" size={13} tone="quaternary" weight="semibold" /> : null}
    </>
  );
  const rowClass = cn('min-h-14 flex-row items-center gap-3 px-gutter py-3', disabled && 'opacity-40');

  if (!onPress) {
    return (
      <View className={rowClass} accessible accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}>
        {content}
      </View>
    );
  }

  function handlePress() {
    haptics.tap();
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      className={cn(rowClass, 'active:bg-surface-2')}
    >
      {content}
    </Pressable>
  );
}
