import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Desplegable nativo (`<select>`): las opciones llegan como `children` (`<option>`). Reenvía `ref` y
 * las props nativas (`aria-describedby`…). Con `invalid` expone `aria-invalid` y se marca en rojo.
 * Se usa el control del navegador, que ya es accesible con teclado y lectores de pantalla.
 */
export const selectVariants = cva(
  'block h-10 w-full min-w-0 rounded-md border bg-surface px-3 text-base text-fg focus-visible:focus-ring disabled:cursor-not-allowed disabled:bg-neutral-bg disabled:text-fg-muted',
  {
    variants: {
      invalid: {
        false: 'border-border-strong',
        true: 'border-danger',
      },
    },
    defaultVariants: { invalid: false },
  },
);

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>, VariantProps<typeof selectVariants> {
  /** El valor no es válido: `aria-invalid` y borde de error. */
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(selectVariants({ invalid }), className)}
      {...props}
    >
      {children}
    </select>
  );
});
