import { brandName } from '../constants';
import { resolveColor, resolveMark, toFillRule, type LogoKind } from '../spec';
import type { LogoBaseProps } from '../types';

export type WebLogoProps = LogoBaseProps & {
  className?: string;
  title?: string;
};

type MarkSvgProps = WebLogoProps & {
  kind: LogoKind;
  defaultSize: number;
};

export function MarkSvg({ kind, defaultSize, size, color, variant, clearSpace = true, className, title = brandName }: MarkSvgProps) {
  const mark = resolveMark(kind, size ?? defaultSize, clearSpace);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={mark.viewBox}
      width={mark.width}
      height={mark.height}
      fill={resolveColor(color, variant)}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      {mark.paths.map((path) => (
        <path key={path.d.slice(0, 24)} d={path.d} fillRule={toFillRule(path.fillRule)} />
      ))}
    </svg>
  );
}
