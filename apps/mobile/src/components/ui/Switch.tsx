import { Host, Switch as NativeSwitch } from '@expo/ui';
import { useDirection } from '@/i18n/useDirection';
import { haptics } from '@/lib/haptics';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Switch({ value, onValueChange, accessibilityLabel, disabled = false }: SwitchProps) {
  const { isRTL } = useDirection();

  function handleChange(next: boolean) {
    haptics.selection();
    onValueChange(next);
  }

  return (
    <Host
      matchContents
      colorScheme="dark"
      layoutDirection={isRTL ? 'rightToLeft' : 'leftToRight'}
      accessibilityLabel={accessibilityLabel}
    >
      <NativeSwitch value={value} onValueChange={handleChange} disabled={disabled} />
    </Host>
  );
}
