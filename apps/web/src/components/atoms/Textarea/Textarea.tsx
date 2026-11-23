import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Campo de texto de varias líneas (`<textarea>` nativo). Reenvía `ref` y las props nativas
 * (`rows`, `aria-describedby`…). Con `invalid` expone `aria-invalid` y se marca en rojo. Solo se
 * redimensiona en vertical para no desbordar el ancho de la pantalla.
 */
export const textareaVariants = cva(
  'block min-h-24 w-full min-w-0 resize-y rounded-md border bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-muted focus-visible:focus-ring disabled:cursor-not-allowed disabled:bg-neutral-bg disabled:text-fg-muted',
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

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {
  /** El valor no es válido: `aria-invalid` y borde de error. */
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, rows = 4, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(textareaVariants({ invalid }), className)}
      {...props}
    />
  );
});
