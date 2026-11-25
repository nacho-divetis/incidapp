import type { IncidentListItem } from '@incidapp/shared';
import type { ElementType } from 'react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import {
  Icon,
  Link,
  Spinner,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
} from '../../atoms';
import { PriorityBadge, StatusBadge } from '../../molecules';

export interface IncidentTableProps {
  /** Incidencias de la página actual (`IncidentListResponse.items`). */
  items: IncidentListItem[];
  /** Ruta del detalle de una incidencia. */
  getDetailHref: (id: string) => string;
  /** Componente de enlace del enrutador; recibe el destino en `to`. */
  linkAs?: ElementType;
  /** Cargando la primera página: indicador en lugar de la tabla. */
  isLoading?: boolean;
  /** Nombre accesible de la tabla. */
  caption?: string;
  /** Mensaje cuando no hay incidencias. */
  emptyMessage?: string;
  /** Texto del indicador de carga. */
  loadingLabel?: string;
  className?: string;
}

/** Contenedor de los estados sin tabla (cargando y vacío). */
const placeholderClass = 'flex items-center gap-3 rounded-lg border border-border bg-surface p-6';

/**
 * Tabla del listado de incidencias (CA-03.12).
 *
 * - Columnas: código (enlace al detalle y cabecera de su fila), título, tipo, departamento,
 *   prioridad y estado (`PriorityBadge` y `StatusBadge`, en español), asignado ("Sin asignar") y
 *   fecha objetivo en `dd/mm/aaaa` ("Sin fecha").
 * - El departamento se muestra por su código; el nombre completo está en el `title` y es lo que leen
 *   los lectores de pantalla (como en `UserTable`).
 * - Sin incidencias, muestra `emptyMessage`; con `isLoading`, un indicador de carga.
 * - Nombre accesible: `caption` oculto (el título visible es el de la página). En móvil la tabla se
 *   desplaza dentro de su contenedor; cada fila tiene un enlace enfocable.
 * - `linkAs`: el `Link` de React Router, que recibe el destino en `to`. Sin él, `<a href>`.
 * - Presentacional: no pide datos ni mira permisos (el listado no trae `allowedActions`).
 */
export function IncidentTable({
  items,
  getDetailHref,
  linkAs,
  isLoading = false,
  caption = 'Incidencias',
  emptyMessage = 'No hay incidencias que coincidan con los filtros.',
  loadingLabel = 'Cargando incidencias…',
  className,
}: IncidentTableProps) {
  if (isLoading) {
    return (
      <div className={cn(placeholderClass, 'justify-center', className)}>
        <Spinner label={loadingLabel} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn(placeholderClass, className)}>
        <Icon name="inbox" size="lg" className="text-fg-muted" />
        <Text variant="muted">{emptyMessage}</Text>
      </div>
    );
  }

  return (
    <Table containerClassName={className}>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Código</TableHeaderCell>
          <TableHeaderCell>Título</TableHeaderCell>
          <TableHeaderCell>Tipo</TableHeaderCell>
          <TableHeaderCell>Departamento</TableHeaderCell>
          <TableHeaderCell>Prioridad</TableHeaderCell>
          <TableHeaderCell>Estado</TableHeaderCell>
          <TableHeaderCell>Asignado</TableHeaderCell>
          <TableHeaderCell>Fecha objetivo</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((incident) => {
          const href = getDetailHref(incident.id);
          return (
            <TableRow key={incident.id}>
              <TableHeaderCell scope="row" className="whitespace-nowrap">
                <Link {...(linkAs ? { as: linkAs, to: href } : { href })}>{incident.code}</Link>
              </TableHeaderCell>
              <TableCell className="min-w-48">{incident.title}</TableCell>
              <TableCell className="min-w-32">{incident.type.name}</TableCell>
              <TableCell>
                <span title={incident.department.name}>
                  <span aria-hidden="true">{incident.department.code}</span>
                  <span className="sr-only">{incident.department.name}</span>
                </span>
              </TableCell>
              <TableCell>
                <PriorityBadge priority={incident.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={incident.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {incident.assignee ? (
                  incident.assignee.name
                ) : (
                  <Text as="span" variant="small">
                    Sin asignar
                  </Text>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {incident.dueDate ? (
                  formatDate(incident.dueDate)
                ) : (
                  <Text as="span" variant="small">
                    Sin fecha
                  </Text>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
