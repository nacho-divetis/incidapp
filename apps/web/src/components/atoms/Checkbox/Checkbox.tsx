import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Casilla de verificación nativa (`<input type="checkbox">`). Con `label`, la casilla y su texto van
 * dentro del mismo `<label>` (pulsar el texto la marca). Sin `label`, hay que darle un nombre
 * accesible por fuera (`Label` con `htmlFor`, o `aria-label`). Reenvía `ref` y las props nativas.
 */
export const checkboxVariants = cva(
  'size-4 shrink-0 cursor-pointer rounded-sm accent-primary focus-visible:focus-ring disabled:cursor-not-allowed',
  {
    variants: {
      invalid: {
        false: '',
        true: 'accent-danger',
      },
    },
    defaultVariants: { invalid: false },
  },
);

export interface CheckboxProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>,
    VariantProps<typeof checkboxVariants> {
  /** Texto de la casilla (opcional). */
  label?: ReactNode;
  /** El valor no es válido: `aria-invalid`. */
  invalid?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, invalid = false, className, disabled, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      className={cn(checkboxVariants({ invalid }), !label && className)}
      {...props}
    />
  );

  if (!label) return input;

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 text-base text-fg',
        disabled ? 'cursor-not-allowed text-fg-muted' : 'cursor-pointer',
        className,
      )}
    >
      {input}
      <span>{label}</span>
    </label>
  );
});
