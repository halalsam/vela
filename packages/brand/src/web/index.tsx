import { defaultSizes } from '../spec';
import type { LockupOrientation } from '../types';
import { MarkSvg, type WebLogoProps } from './MarkSvg';

export type { WebLogoProps };

export function VelaSymbol(props: WebLogoProps) {
  return <MarkSvg kind="symbol" defaultSize={defaultSizes.symbol} {...props} />;
}

export function VelaWordmark(props: WebLogoProps) {
  return <MarkSvg kind="wordmark" defaultSize={defaultSizes.wordmark} {...props} />;
}

export type WebLockupProps = WebLogoProps & {
  orientation?: LockupOrientation;
};

export function VelaLockup({ orientation = 'horizontal', ...props }: WebLockupProps) {
  return <MarkSvg kind={orientation} defaultSize={defaultSizes[orientation]} {...props} />;
}
