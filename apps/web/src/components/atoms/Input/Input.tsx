import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Campo de texto de una línea (`<input>` nativo). Reenvía `ref` y todas las props nativas
 * (`aria-describedby`, `autoComplete`…). Con `invalid` expone `aria-invalid` y se marca en rojo.
 * La etiqueta va aparte, con `Label` (`htmlFor` = `id` del campo).
 */
export const inputVariants = cva(
  'block h-10 w-full min-w-0 rounded-md border bg-surface px-3 text-base text-fg placeholder:text-fg-muted focus-visible:focus-ring disabled:cursor-not-allowed disabled:bg-neutral-bg disabled:text-fg-muted',
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

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {
  /** El valor no es válido: `aria-invalid` y borde de error. */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, type = 'text', className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ invalid }), className)}
      {...props}
    />
  );
});
