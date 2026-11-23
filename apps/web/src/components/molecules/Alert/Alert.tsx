import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from '../../atoms';

/**
 * Aviso en línea con un tono: `info`, `success`, `warning` o `danger`, con un icono que lo refuerza
 * (el significado está siempre en el texto, no solo en el color).
 *
 * Región accesible según el tono: `danger` y `warning` son `role="alert"` (los lectores de pantalla
 * los anuncian al aparecer, interrumpiendo); `info` y `success` son `role="status"` (se anuncian sin
 * interrumpir). Para que se anuncie, el aviso tiene que insertarse en el DOM cuando ocurre el hecho
 * (p. ej. pintarlo solo cuando hay `errorMessage`).
 *
 * Sin textos propios: título y contenido llegan por props.
 */
export const alertVariants = cva('flex items-start gap-3 rounded-md border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-info-border bg-info-bg text-info-fg',
      success: 'border-success-border bg-success-bg text-success-fg',
      warning: 'border-warning-border bg-warning-bg text-warning-fg',
      danger: 'border-danger-border bg-danger-bg text-danger-fg',
    },
  },
  defaultVariants: { tone: 'info' },
});

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>['tone']>;

const toneIcon: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'circle-check',
  warning: 'warning',
  danger: 'circle-x',
};

const toneRole: Record<AlertTone, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  danger: 'alert',
};

export interface AlertProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'>,
    VariantProps<typeof alertVariants> {
  /** Título breve en negrita, encima del contenido. */
  title?: ReactNode;
  /** Mensaje del aviso. */
  children: ReactNode;
}

export function Alert({ tone, title, children, className, ...props }: AlertProps) {
  const resolvedTone: AlertTone = tone ?? 'info';
  return (
    <div
      role={toneRole[resolvedTone]}
      className={cn(alertVariants({ tone: resolvedTone }), className)}
      {...props}
    >
      <Icon name={toneIcon[resolvedTone]} size="md" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
