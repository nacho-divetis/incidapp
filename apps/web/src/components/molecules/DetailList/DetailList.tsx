import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Un dato de la lista: su nombre y su valor. */
export interface DetailListItem {
  /** Nombre del dato (`<dt>`). */
  label: ReactNode;
  /** Valor del dato (`<dd>`): texto, una insignia, un enlace… */
  value: ReactNode;
  /** Clave estable; si no se indica, se usa la etiqueta si es texto, o la posición. */
  key?: string;
}

export const detailListVariants = cva('grid gap-x-6 gap-y-4', {
  variants: {
    columns: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    },
  },
  defaultVariants: { columns: 2 },
});

export interface DetailListProps
  extends
    Omit<HTMLAttributes<HTMLDListElement>, 'children'>,
    VariantProps<typeof detailListVariants> {
  items: DetailListItem[];
}

/**
 * Lista de datos "nombre: valor" (`<dl>`) en una rejilla de 1 a 3 columnas (una sola en móvil). Cada
 * par va en un `<div>` (permitido dentro de `<dl>`), con el nombre en pequeño y atenuado encima del
 * valor. La usa el detalle de una incidencia.
 *
 * Sin textos propios: nombres y valores llegan por `items`.
 */
export function DetailList({ items, columns, className, ...props }: DetailListProps) {
  return (
    <dl className={cn(detailListVariants({ columns }), className)} {...props}>
      {items.map((item, index) => (
        <div
          key={item.key ?? (typeof item.label === 'string' ? item.label : index)}
          className="flex min-w-0 flex-col gap-1"
        >
          <dt className="text-sm font-medium text-fg-muted">{item.label}</dt>
          <dd className="text-base break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
