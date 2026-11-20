import { defaultSizes } from '../spec';
import type { LockupOrientation } from '../types';
import { MarkSvg, type NativeLogoProps } from './MarkSvg';

export type { NativeLogoProps };

export function VelaSymbol(props: NativeLogoProps) {
  return <MarkSvg kind="symbol" defaultSize={defaultSizes.symbol} {...props} />;
}

export function VelaWordmark(props: NativeLogoProps) {
  return <MarkSvg kind="wordmark" defaultSize={defaultSizes.wordmark} {...props} />;
}

export type NativeLockupProps = NativeLogoProps & {
  orientation?: LockupOrientation;
};

export function VelaLockup({ orientation = 'horizontal', ...props }: NativeLockupProps) {
  return <MarkSvg kind={orientation} defaultSize={defaultSizes[orientation]} {...props} />;
}
