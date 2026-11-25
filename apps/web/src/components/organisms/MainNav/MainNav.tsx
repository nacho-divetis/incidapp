import type { ElementType } from 'react';
import { cn } from '@/lib/cn';
import { Icon, Link, type IconName } from '../../atoms';

/** Enlace de la navegación principal. */
export interface MainNavItem {
  /** Texto del enlace. */
  label: string;
  /** Destino del enlace. */
  href: string;
  /** Es la página actual: el enlace lleva `aria-current="page"` y se resalta. */
  current: boolean;
  /** Icono decorativo delante del texto (opcional). */
  icon?: IconName;
}

/**
 * Enlaces de la navegación principal de las pantallas con sesión (CA-02.16).
 *
 * - Va dentro del hueco `nav` de `AppLayout`, que ya pone el *landmark* `<nav>` con su nombre: aquí
 *   solo hay la lista de enlaces (no se repite el `<nav>`).
 * - El enlace de la página actual lleva `aria-current="page"` y se resalta (no solo por color: tiene
 *   fondo y peso de letra distintos).
 * - Qué enlaces aparecen lo decide quien lo usa (`app/`, a partir de `allowedActions`); el organismo
 *   solo los pinta, sin mirar el rol.
 * - En móvil los enlaces van en fila (y saltan de línea si no caben); desde `md`, en columna.
 * - `linkAs`: componente de enlace del enrutador (el `Link` de React Router), que recibe el destino
 *   en `to`. Sin él, se pinta un `<a href>`.
 */
export interface MainNavProps {
  items: MainNavItem[];
  /** Componente de enlace del enrutador; recibe el destino en `to`. */
  linkAs?: ElementType;
  className?: string;
}

export function MainNav({ items, linkAs, className }: MainNavProps) {
  if (items.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap gap-1 p-2 md:flex-col md:p-3', className)}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            {...(linkAs ? { as: linkAs, to: item.href } : { href: item.href })}
            variant="subtle"
            aria-current={item.current ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 hover:bg-neutral-bg hover:no-underline',
              item.current && 'bg-primary-bg font-semibold text-primary-fg hover:bg-primary-bg',
            )}
          >
            {item.icon && <Icon name={item.icon} size="sm" />}
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
