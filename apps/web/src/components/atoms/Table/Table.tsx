import { cva, type VariantProps } from 'class-variance-authority';
import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Tabla de datos con sus partes semánticas: `Table` (`<table>`), `TableCaption`, `TableHead`
 * (`<thead>`), `TableBody` (`<tbody>`), `TableRow` (`<tr>`), `TableHeaderCell` (`<th>` con `scope`)
 * y `TableCell` (`<td>`).
 *
 * - `Table` envuelve la tabla en un contenedor con desplazamiento horizontal propio: en móvil se
 *   desplaza la tabla, no la página.
 * - Si la tabla puede ser más ancha que la pantalla y no tiene enlaces ni botones (nada que
 *   enfocar), pasa `regionLabel`: el contenedor pasa a ser una región con nombre que se puede
 *   enfocar con el teclado para desplazarla (si no, axe da `scrollable-region-focusable`).
 * - La tabla necesita un nombre accesible: `TableCaption` (visible u oculto con `sr-only`),
 *   `aria-label` o `aria-labelledby` en `Table`.
 *
 * Sin textos propios ni dominio: el contenido llega por `children`.
 */

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Clases del contenedor con desplazamiento (el `className` va a la `<table>`). */
  containerClassName?: string;
  /** Nombre del contenedor desplazable; lo convierte en una región enfocable con el teclado. */
  regionLabel?: string;
}

export function Table({ containerClassName, regionLabel, className, ...props }: TableProps) {
  const region = regionLabel
    ? ({ role: 'region', 'aria-label': regionLabel, tabIndex: 0 } as const)
    : {};
  return (
    <div
      {...region}
      className={cn(
        'w-full overflow-x-auto rounded-lg border border-border bg-surface focus-visible:focus-ring',
        containerClassName,
      )}
    >
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  );
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('px-4 py-3 text-left text-base font-semibold text-fg', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border bg-surface-muted', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

// Separador entre filas; la primera fila de cada sección no lo lleva (la cabecera ya tiene borde).
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-t border-border first:border-t-0', className)} {...props} />;
}

/**
 * Cabecera de columna (`scope="col"`, por defecto, en `TableHead`) o de fila (`scope="row"`, la
 * primera celda de una fila en `TableBody`). El aspecto sigue al `scope`.
 */
export const tableHeaderCellVariants = cva('px-4 py-3 align-top', {
  variants: {
    scope: {
      col: 'font-semibold whitespace-nowrap text-fg-muted',
      row: 'font-medium text-fg',
      colgroup: 'font-semibold whitespace-nowrap text-fg-muted',
      rowgroup: 'font-medium text-fg',
    },
  },
  defaultVariants: { scope: 'col' },
});

export interface TableHeaderCellProps
  extends
    Omit<ThHTMLAttributes<HTMLTableCellElement>, 'scope'>,
    VariantProps<typeof tableHeaderCellVariants> {}

export function TableHeaderCell({ scope, className, ...props }: TableHeaderCellProps) {
  const resolvedScope = scope ?? 'col';
  return (
    <th
      scope={resolvedScope}
      className={cn(tableHeaderCellVariants({ scope: resolvedScope }), className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-top text-fg', className)} {...props} />;
}
