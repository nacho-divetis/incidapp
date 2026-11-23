import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Texto de párrafo. Variantes: `body` (normal), `muted` (secundario, atenuado) y `small` (pequeño,
 * para ayudas y metadatos). `as` cambia la etiqueta (`p` por defecto; `span` o `div` si va dentro
 * de otro elemento de texto).
 */
export const textVariants = cva('', {
  variants: {
    variant: {
      body: 'text-base text-fg',
      muted: 'text-base text-fg-muted',
      small: 'text-sm text-fg-muted',
    },
  },
  defaultVariants: { variant: 'body' },
});

export interface TextProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  /** Etiqueta HTML. */
  as?: 'p' | 'span' | 'div';
}

export function Text({ variant, as: Tag = 'p', className, ...props }: TextProps) {
  return <Tag className={cn(textVariants({ variant }), className)} {...props} />;
}
