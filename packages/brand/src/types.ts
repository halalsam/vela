import type { LogoVariant } from './spec';

export type LogoBaseProps = {
  /** Height of the mark itself in px. Clear space is added outside it. */
  size?: number;
  /** Any colour. Wins over `variant`. Defaults to currentColor. */
  color?: string;
  /** `light` = artwork for light grounds (matte black). `dark` = for dark grounds (white). */
  variant?: LogoVariant;
  /** Adds the brand clear space (6u) around the mark. */
  clearSpace?: boolean;
};

export type LockupOrientation = 'horizontal' | 'stacked';
