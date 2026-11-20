import { colors } from '@vela/tokens';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useDirection } from '@/i18n/useDirection';
import { cn } from '@/lib/cn';
import type { IconName } from '@/lib/icons';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type InputProps = Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'className'> & {
  ref?: Ref<TextInputInstance>;
  label?: string;
  leadingIcon?: IconName;
  clearable?: boolean;
  error?: string;
  helper?: string;
  variant?: 'default' | 'search';
  className?: string;
};

export function Input({
  ref,
  label,
  leadingIcon,
  clearable = false,
  error,
  helper,
  variant = 'default',
  className,
  value,
  onChangeText,
  onFocus,
  onBlur,
  accessibilityLabel,
  placeholder,
  ...rest
}: InputProps) {
  const { t } = useTranslation();
  const { isRTL } = useDirection();
  const [focused, setFocused] = useState(false);
  const isSearch = variant === 'search';
  const icon = leadingIcon ?? (isSearch ? 'search' : undefined);
  const showClear = (clearable || isSearch) && Boolean(value);

  return (
    <View className={cn('gap-2', className)}>
      {label ? (
        <Text variant="label" tone="tertiary">
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'flex-row items-center gap-2 border ps-4',
          isSearch ? 'h-11 rounded-pill bg-surface-2' : 'h-button rounded-button bg-surface-1',
          showClear ? 'pe-1' : 'pe-4',
          error ? 'border-danger' : focused ? 'border-fg-tertiary' : 'border-line',
        )}
      >
        {icon ? <Icon name={icon} size={16} tone="tertiary" /> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.fg.tertiary}
          selectionColor={colors.accent.DEFAULT}
          cursorColor={colors.accent.DEFAULT}
          keyboardAppearance="dark"
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          className={cn('h-full flex-1 text-field text-fg', isRTL ? 'font-arabic' : 'font-sans')}
          {...rest}
        />
        {showClear ? (
          <IconButton
            icon="clear"
            variant="ghost"
            size="sm"
            haptic={false}
            accessibilityLabel={t('ui.clear')}
            onPress={() => onChangeText?.('')}
          />
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="tertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
