import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn, type } from '@/lib/type';

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
export const press = 'transition-transform duration-fast ease-vela active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100';

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-gutter md:px-8', className)}>{children}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';

const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-fg-inverse hover:bg-ivory',
  secondary: 'border border-line bg-surface-2 text-fg hover:border-line-strong',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  accent: 'bg-accent text-fg-inverse hover:brightness-110',
};

function buttonClass(variant: ButtonVariant, size: 'md' | 'sm', fullWidth?: boolean, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:pointer-events-none disabled:opacity-40',
    type.calloutStrong,
    size === 'md' ? 'h-button rounded-button px-6 text-body rtl:text-body-ar' : 'h-button-compact rounded-button px-4',
    buttonVariant[variant],
    fullWidth && 'w-full',
    focusRing,
    press,
    className,
  );
}

type ButtonOwnProps = { variant?: ButtonVariant; size?: 'md' | 'sm'; fullWidth?: boolean };

export function Button({ variant = 'primary', size = 'md', fullWidth, className, ...rest }: ButtonOwnProps & ComponentProps<'button'>) {
  return <button type="button" className={buttonClass(variant, size, fullWidth, className)} {...rest} />;
}

export function ButtonLink({ variant = 'primary', size = 'md', fullWidth, className, ...rest }: ButtonOwnProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, fullWidth, className)} {...rest} />;
}

export function Card({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <Tag className={cn('rounded-card border border-line border-t-line-highlight bg-surface-1', className)}>{children}</Tag>;
}

export const cardLink = cn(
  'block rounded-card border border-line border-t-line-highlight bg-surface-1 transition duration-fast ease-vela hover:border-line-strong hover:bg-surface-2 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
  focusRing,
);

type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const pillTone: Record<PillTone, string> = {
  neutral: 'bg-surface-3 text-fg-secondary',
  accent: 'bg-accent-tint text-accent',
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
};

export function Pill({ children, tone = 'neutral', caps, className }: { children: ReactNode; tone?: PillTone; caps?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-chip px-2', caps ? type.labelSm : type.caption, 'font-sans-semibold rtl:font-arabic-semibold', pillTone[tone], className)}>
      {children}
    </span>
  );
}

export function SectionTitle({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={cn(type.title, 'text-fg', className)}>
      {children}
    </h2>
  );
}

type FieldProps = ComponentProps<'input'> & { label: string; error?: string | null; hint?: string };

export function Field({ label, error, hint, id, className, ...rest }: FieldProps) {
  const inputId = id ?? rest.name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className={cn(type.label, 'text-fg-tertiary')}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-button rounded-button border bg-surface-1 px-4 text-fg placeholder:text-fg-tertiary',
          type.body,
          error ? 'border-danger' : 'border-line focus:border-fg-tertiary',
          'outline-none transition-colors duration-fast ease-vela',
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className={cn(type.caption, 'text-danger')}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className={cn(type.caption, 'text-fg-tertiary')}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
