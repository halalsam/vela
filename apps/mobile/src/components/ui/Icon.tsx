import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { useDirection } from '@/i18n/useDirection';
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
  const { isRTL } = useDirection();
  // Flip directional glyphs from the app language, not NativeWind's `rtl:` variant,
  // which also fired in English and pointed every chevron backwards.
  const mirror = 'mirror' in spec && spec.mirror && isRTL;
  return (
    <SymbolView
      name={{ ios: spec.ios, android: spec.android }}
      size={size}
      tintColor={color ?? toneColor[tone]}
      weight={weight}
      style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}
      className={className}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
