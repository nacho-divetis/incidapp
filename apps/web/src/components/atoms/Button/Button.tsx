import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Botón base de la aplicación. Variantes: primario, secundario, fantasma y peligro; tamaños sm y md.
 *
 * - `loading`: muestra un indicador de carga en lugar de `leftIcon`, expone `aria-busy` y bloquea el
 *   clic (el botón queda deshabilitado). Un átomo no puede usar otro átomo, por eso el indicador se
 *   pinta aquí con `lucide-react` en lugar de usar `Spinner`.
 * - `leftIcon`: cualquier nodo (normalmente `<Icon name="…" />`); se oculta a los lectores de pantalla.
 * - `type` vale `button` por defecto; para enviar un formulario, `type="submit"`.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap transition-colors focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-primary-contrast hover:enabled:bg-primary-hover',
        secondary: 'border-border-strong bg-surface text-fg hover:enabled:bg-neutral-bg',
        ghost: 'border-transparent bg-transparent text-fg hover:enabled:bg-neutral-bg',
        danger: 'border-transparent bg-danger text-danger-contrast hover:enabled:bg-danger-hover',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

// Tamaño del indicador de carga según `size` (el de `leftIcon` lo decide quien lo pasa).
const indicatorSize = { sm: 'size-4', md: 'size-5' } as const;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Acción en curso: indicador de carga, `aria-busy` y sin clic. */
  loading?: boolean;
  /** Icono a la izquierda del texto (decorativo). */
  leftIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    loading = false,
    disabled,
    leftIcon,
    type = 'button',
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className={cn(indicatorSize[size ?? 'md'], 'animate-spin')}
        />
      ) : (
        leftIcon && (
          <span aria-hidden="true" className="inline-flex">
            {leftIcon}
          </span>
        )
      )}
      {children}
    </button>
  );
});
