import { Host, Picker } from '@expo/ui';
import { useDirection } from '@/i18n/useDirection';
import { haptics } from '@/lib/haptics';

export type MenuPickerOption<T extends string> = { value: T; label: string };

export type MenuPickerProps<T extends string> = {
  value: T;
  options: readonly MenuPickerOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

export function MenuPicker<T extends string>({ value, options, onChange, accessibilityLabel }: MenuPickerProps<T>) {
  const { isRTL } = useDirection();
  return (
    <Host matchContents colorScheme="dark" layoutDirection={isRTL ? 'rightToLeft' : 'leftToRight'}>
      <Picker<T>
        appearance="menu"
        selectedValue={value}
        accessibilityLabel={accessibilityLabel}
        onValueChange={(next) => {
          haptics.selection();
          onChange(next);
        }}
      >
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </Host>
  );
}
