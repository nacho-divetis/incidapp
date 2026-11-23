import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Etiqueta de un campo de formulario (`<label>` nativo), asociada al campo con `htmlFor`.
 * Con `required` añade un asterisco visual y, para los lectores de pantalla, `requiredText`
 * ("obligatorio" por defecto) en lugar del asterisco.
 */
export const labelVariants = cva('inline-block font-medium text-fg', {
  variants: {
    size: {
      sm: 'text-sm',
      md: 'text-base',
    },
  },
  defaultVariants: { size: 'sm' },
});

export interface LabelProps
  extends LabelHTMLAttributes<HTMLLabelElement>, VariantProps<typeof labelVariants> {
  /** El campo es obligatorio: asterisco visual y texto accesible. */
  required?: boolean;
  /** Texto que leen los lectores de pantalla en lugar del asterisco. */
  requiredText?: string;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required = false, requiredText = 'obligatorio', size, className, children, ...props },
  ref,
) {
  return (
    <label ref={ref} className={cn(labelVariants({ size }), className)} {...props}>
      {children}
      {required && (
        <>
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
          {/* El espacio va fuera del span para que forme parte del nombre accesible del campo. */}{' '}
          <span className="sr-only">({requiredText})</span>
        </>
      )}
    </label>
  );
});
