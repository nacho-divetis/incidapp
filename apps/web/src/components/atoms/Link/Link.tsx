import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Enlace con el estilo de la aplicación y foco visible. Variantes: `default` (color primario y
 * subrayado, para enlaces dentro del texto o sueltos) y `subtle` (texto secundario que se subraya al
 * pasar por encima, para enlaces de menor peso).
 *
 * Es polimórfico: por defecto pinta un `<a>`, y con `as` pinta otro componente con el mismo estilo
 * (p. ej. el `Link` de React Router, que pasa la página: `<Link as={RouterLink} to="/">`). Así el
 * átomo no conoce el router. Las props y la `ref` se reenvían al elemento o componente pintado.
 *
 * Con `target="_blank"` añade `rel="noopener noreferrer"` si no se indica otro `rel`.
 */
export const linkVariants = cva(
  'rounded-sm font-medium underline-offset-2 transition-colors focus-visible:focus-ring',
  {
    variants: {
      variant: {
        default: 'text-primary underline hover:text-primary-hover',
        subtle: 'text-fg-muted no-underline hover:text-fg hover:underline',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface LinkOwnProps<E extends ElementType> extends VariantProps<typeof linkVariants> {
  /** Elemento o componente que se pinta (`a` por defecto). */
  as?: E;
  className?: string;
  children?: ReactNode;
}

export type LinkProps<E extends ElementType = 'a'> = LinkOwnProps<E> &
  Omit<ComponentPropsWithRef<E>, keyof LinkOwnProps<E>>;

export function Link<E extends ElementType = 'a'>({
  as,
  variant,
  className,
  ...props
}: LinkProps<E>) {
  const Component: ElementType = as ?? 'a';
  const { target, rel } = props as { target?: string; rel?: string };
  const safeRel = target === '_blank' && rel === undefined ? 'noopener noreferrer' : rel;
  return (
    <Component {...props} rel={safeRel} className={cn(linkVariants({ variant }), className)} />
  );
}
