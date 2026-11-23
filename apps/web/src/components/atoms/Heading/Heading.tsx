import { cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Título de sección. `level` (1–4) decide el tamaño y, por defecto, la etiqueta (`h1`…`h4`).
 * `as` separa la semántica del aspecto: `<Heading level={3} as="h2">` es un `h2` con tamaño de nivel 3.
 */
export const headingVariants = cva('font-semibold text-fg', {
  variants: {
    level: {
      1: 'text-2xl sm:text-3xl',
      2: 'text-xl sm:text-2xl',
      3: 'text-lg',
      4: 'text-base',
    },
  },
  defaultVariants: { level: 2 },
});

export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Nivel visual (y semántico si no se indica `as`). */
  level?: HeadingLevel;
  /** Etiqueta HTML, si debe ser distinta del nivel visual. */
  as?: HeadingTag;
}

export function Heading({ level = 2, as, className, ...props }: HeadingProps) {
  const Tag = as ?? (`h${level}` as const);
  return <Tag className={cn(headingVariants({ level }), className)} {...props} />;
}
