import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { brandName } from '../constants';
import { resolveColor, resolveMark, toFillRule, type LogoKind } from '../spec';
import type { LogoBaseProps } from '../types';

export type NativeLogoProps = LogoBaseProps & {
  style?: StyleProp<ViewStyle>;
  className?: string;
  accessibilityLabel?: string;
};

type MarkSvgProps = NativeLogoProps & {
  kind: LogoKind;
  defaultSize: number;
};

export function MarkSvg({
  kind,
  defaultSize,
  size,
  color,
  variant,
  clearSpace = true,
  style,
  accessibilityLabel = brandName,
}: MarkSvgProps) {
  const mark = resolveMark(kind, size ?? defaultSize, clearSpace);
  const fill = resolveColor(color, variant);
  return (
    <Svg
      viewBox={mark.viewBox}
      width={mark.width}
      height={mark.height}
      color={fill === 'currentColor' ? undefined : fill}
      style={style}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {mark.paths.map((path) => (
        <Path key={path.d.slice(0, 24)} d={path.d} fill="currentColor" fillRule={toFillRule(path.fillRule)} />
      ))}
    </Svg>
  );
}
