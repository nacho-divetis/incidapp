import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Indicador de carga. Es una región `role="status"`: los lectores de pantalla anuncian `label`
 * (obligatorio, p. ej. "Cargando incidencias…"), que no se ve en pantalla.
 */
export const spinnerVariants = cva('animate-spin text-primary', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-6',
      lg: 'size-10',
    },
  },
  defaultVariants: { size: 'md' },
});

export interface SpinnerProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'role'>, VariantProps<typeof spinnerVariants> {
  /** Texto que anuncian los lectores de pantalla. */
  label: string;
}

export function Spinner({ label, size, className, ...props }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center', className)} {...props}>
      <LoaderCircle aria-hidden="true" className={spinnerVariants({ size })} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
