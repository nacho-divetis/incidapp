import type { Incident } from '@incidapp/shared';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { Heading, Text, type HeadingTag } from '../../atoms';
import { DetailList, PriorityBadge, StatusBadge, type DetailListItem } from '../../molecules';

export interface IncidentSummaryProps {
  /** Detalle de la incidencia (`GET /api/incidents/:id`). */
  incident: Incident;
  /**
   * Hueco para las acciones que decide la página según `incident.allowedActions` (p. ej. "Editar")
   * y, en F04, según `allowedTransitions`. Sin acciones, no se pinta nada.
   */
  actions?: ReactNode;
  /** Etiqueta del título (por defecto `h1`: es el título de la página de detalle). */
  headingAs?: HeadingTag;
  className?: string;
}

/** Texto atenuado para un dato que falta ("Sin asignar", "Sin fecha objetivo"). */
function missing(text: string) {
  return (
    <Text as="span" variant="muted">
      {text}
    </Text>
  );
}

/**
 * Resumen del detalle de una incidencia (CA-03.14).
 *
 * - Cabecera: código, título, `StatusBadge` y `PriorityBadge`, y el hueco `actions` a la derecha
 *   (debajo en móvil).
 * - `DetailList` con tipo, departamento, creador, asignado ("Sin asignar"), fecha objetivo ("Sin
 *   fecha objetivo"), creación, última actualización y, si las hay, resolución y cierre; todas las
 *   fechas en `dd/mm/aaaa` (zona `Europe/Madrid`).
 * - Descripción en su propia sección, respetando los saltos de línea.
 * - Presentacional: no decide qué acciones se ven; las recibe ya filtradas por la página según
 *   `allowedActions` (nunca por el rol).
 */
export function IncidentSummary({
  incident,
  actions,
  headingAs = 'h1',
  className,
}: IncidentSummaryProps) {
  const descriptionId = useId();
  const { department } = incident;

  const details: DetailListItem[] = [
    { label: 'Tipo', value: incident.type.name },
    { label: 'Departamento', value: `${department.name} (${department.code})` },
    { label: 'Creada por', value: incident.createdBy.name },
    { label: 'Asignada a', value: incident.assignee?.name ?? missing('Sin asignar') },
    {
      label: 'Fecha objetivo',
      value: incident.dueDate ? formatDate(incident.dueDate) : missing('Sin fecha objetivo'),
    },
    { label: 'Creada el', value: formatDate(incident.createdAt) },
    { label: 'Actualizada el', value: formatDate(incident.updatedAt) },
  ];
  if (incident.resolvedAt) {
    details.push({ label: 'Resuelta el', value: formatDate(incident.resolvedAt) });
  }
  if (incident.closedAt) {
    details.push({ label: 'Cerrada el', value: formatDate(incident.closedAt) });
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Text variant="small" className="font-mono font-medium">
            {incident.code}
          </Text>
          <Heading level={1} as={headingAs} className="break-words">
            {incident.title}
          </Heading>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={incident.status} size="md" />
            <PriorityBadge priority={incident.priority} size="md" />
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <DetailList
        items={details}
        columns={3}
        className="rounded-lg border border-border bg-surface p-4"
      />

      <section aria-labelledby={descriptionId} className="flex flex-col gap-2">
        <Heading level={3} as="h2" id={descriptionId}>
          Descripción
        </Heading>
        <Text className="break-words whitespace-pre-line">{incident.description}</Text>
      </section>
    </div>
  );
}
