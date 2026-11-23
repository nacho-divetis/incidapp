import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Insignia de texto corto con un tono semántico (neutral, info, éxito, aviso, peligro o primario).
 * No conoce el dominio: las insignias de estado y prioridad (F03) son moléculas que eligen el tono.
 * El tono es solo visual; el significado tiene que estar en el texto.
 */
export const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 truncate rounded-md border font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-neutral-border bg-neutral-bg text-neutral-fg',
        info: 'border-info-border bg-info-bg text-info-fg',
        success: 'border-success-border bg-success-bg text-success-fg',
        warning: 'border-warning-border bg-warning-bg text-warning-fg',
        danger: 'border-danger-border bg-danger-bg text-danger-fg',
        primary: 'border-primary-border bg-primary-bg text-primary-fg',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ tone, size, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
