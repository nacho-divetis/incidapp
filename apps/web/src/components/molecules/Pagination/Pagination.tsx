import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button, Icon, Text } from '../../atoms';

/** Datos que recibe `formatSummary` para componer el resumen. */
export interface PaginationSummary {
  /** Total de resultados. */
  total: number;
  /** Página actual (desde 1). */
  page: number;
  /** Número de páginas (al menos 1, aunque no haya resultados). */
  pageCount: number;
}

/** Resumen por defecto: "1 resultado · Página 1 de 1", "45 resultados · Página 2 de 3". */
function defaultSummary({ total, page, pageCount }: PaginationSummary): string {
  const results = total === 1 ? '1 resultado' : `${total} resultados`;
  return `${results} · Página ${page} de ${pageCount}`;
}

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Página actual (desde 1). */
  page: number;
  /** Resultados por página. */
  pageSize: number;
  /** Total de resultados. */
  total: number;
  /** Se llama con la página a la que se quiere ir. */
  onPageChange: (page: number) => void;
  /** Deshabilita los botones (p. ej., mientras se carga otra página). */
  disabled?: boolean;
  /** Nombre accesible de la navegación. */
  label?: string;
  /** Texto del botón de la página anterior. */
  previousLabel?: string;
  /** Texto del botón de la página siguiente. */
  nextLabel?: string;
  /** Texto del resumen (total y página). */
  formatSummary?: (summary: PaginationSummary) => ReactNode;
}

/**
 * Paginación sencilla de un listado: resumen con el total y la página, y los botones "Anterior" y
 * "Siguiente", deshabilitados en los extremos. Es un `<nav>` con nombre accesible.
 *
 * Controlada y presentacional: no guarda la página; avisa con `onPageChange(página)`. Los textos
 * tienen valores por defecto genéricos y se pueden cambiar por props.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  label = 'Paginación',
  previousLabel = 'Anterior',
  nextLabel = 'Siguiente',
  formatSummary = defaultSummary,
  className,
  ...props
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav
      aria-label={label}
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      <Text variant="small">{formatSummary({ total, page, pageCount })}</Text>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !hasPrevious}
          onClick={() => onPageChange(page - 1)}
          leftIcon={<Icon name="chevron-left" size="sm" />}
        >
          {previousLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
          <Icon name="chevron-right" size="sm" />
        </Button>
      </div>
    </nav>
  );
}
