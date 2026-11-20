import { logoColors } from '@vela/tokens';
import { markGeometry, type MarkName } from './geometry.generated';

export type LogoKind = 'symbol' | 'wordmark' | 'horizontal' | 'stacked';

export type LogoVariant = 'light' | 'dark';

export const GRID_UNIT = 8;
export const CLEAR_SPACE_UNITS = 6;
export const SMALL_CUT_MAX_HEIGHT = 32;

const clearSpaceAtMaster = GRID_UNIT * CLEAR_SPACE_UNITS;

const kindToMark: Record<LogoKind, MarkName> = {
  symbol: 'symbol',
  wordmark: 'wordmark',
  horizontal: 'horizontal',
  stacked: 'stacked',
};

const minWidthByKind: Partial<Record<LogoKind, number>> = {
  horizontal: 140,
  stacked: 96,
  wordmark: 80,
};

const minHeightByKind: Partial<Record<LogoKind, number>> = {
  symbol: 16,
};

export const defaultSizes: Record<LogoKind, number> = {
  symbol: 32,
  wordmark: 24,
  horizontal: 48,
  stacked: 120,
};

export function minHeightFor(kind: LogoKind): number {
  const explicit = minHeightByKind[kind];
  if (explicit !== undefined) return explicit;
  const minWidth = minWidthByKind[kind] ?? 0;
  const geometry = markGeometry[kindToMark[kind]];
  return (minWidth * geometry.height) / geometry.width;
}

export type ResolvedMark = {
  paths: ReadonlyArray<{ readonly d: string; readonly fillRule: string }>;
  viewBox: string;
  width: number;
  height: number;
  markHeight: number;
  smallCut: boolean;
};

export function resolveMark(kind: LogoKind, size: number, clearSpace: boolean): ResolvedMark {
  const markHeight = Math.max(size, minHeightFor(kind));
  const smallCut = kind === 'symbol' && markHeight <= SMALL_CUT_MAX_HEIGHT;
  const geometry = markGeometry[smallCut ? 'symbolSmall' : kindToMark[kind]];
  const margin = clearSpace ? clearSpaceAtMaster : 0;
  const boxWidth = geometry.width + margin * 2;
  const boxHeight = geometry.height + margin * 2;
  const scale = markHeight / geometry.height;
  return {
    paths: geometry.paths,
    viewBox: [geometry.minX - margin, geometry.minY - margin, boxWidth, boxHeight].join(' '),
    width: round(boxWidth * scale),
    height: round(boxHeight * scale),
    markHeight,
    smallCut,
  };
}

export function resolveColor(color: string | undefined, variant: LogoVariant | undefined): string {
  if (color) return color;
  if (variant === 'light') return logoColors.black;
  if (variant === 'dark') return logoColors.white;
  return 'currentColor';
}

export type FillRule = 'nonzero' | 'evenodd';

export function toFillRule(value: string): FillRule {
  return value === 'evenodd' ? 'evenodd' : 'nonzero';
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
