import { colors } from '@vela/tokens';

export type Tone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'inverse';

export const toneTextClass: Record<Tone, string> = {
  primary: 'text-fg',
  secondary: 'text-fg-secondary',
  tertiary: 'text-fg-tertiary',
  quaternary: 'text-fg-quaternary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  inverse: 'text-fg-inverse',
};

export const toneColor: Record<Tone, string> = {
  primary: colors.fg.DEFAULT,
  secondary: colors.fg.secondary,
  tertiary: colors.fg.tertiary,
  quaternary: colors.fg.quaternary,
  accent: colors.accent.DEFAULT,
  success: colors.success.DEFAULT,
  warning: colors.warning.DEFAULT,
  danger: colors.danger.DEFAULT,
  inverse: colors.fg.inverse,
};

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export const statusTint: Record<StatusTone, string> = {
  neutral: 'bg-surface-3',
  success: 'bg-success-tint',
  warning: 'bg-warning-tint',
  danger: 'bg-danger-tint',
  accent: 'bg-accent-tint',
};

export const statusDot: Record<StatusTone, string> = {
  neutral: 'bg-fg-tertiary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
};

export const statusTextTone: Record<StatusTone, Tone> = {
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  accent: 'accent',
};
