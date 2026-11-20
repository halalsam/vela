import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { cn } from '@/lib/cn';
import { icons, type IconName } from '@/lib/icons';
import { toneColor, type Tone } from './tone';

export type IconProps = {
  name: IconName;
  size?: number;
  tone?: Tone;
  color?: string;
  weight?: SymbolWeight;
  className?: string;
  accessibilityLabel?: string;
};

export function Icon({ name, size = 20, tone = 'primary', color, weight = 'medium', className, accessibilityLabel }: IconProps) {
  const spec = icons[name];
  const mirror = 'mirror' in spec && spec.mirror;
  return (
    <SymbolView
      name={{ ios: spec.ios, android: spec.android }}
      size={size}
      tintColor={color ?? toneColor[tone]}
      weight={weight}
      className={cn(mirror && 'rtl:-scale-x-100', className)}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
