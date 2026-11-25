import type { IncidentEvent, IncidentEventType } from '@incidapp/shared';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/dates';
import { describeEvent } from '@/lib/labels';
import { Icon, Text, type IconName } from '../../atoms';

/** Icono decorativo de cada tipo de evento (el significado está en la frase). */
const EVENT_ICONS: Readonly<Record<IncidentEventType, IconName>> = {
  CREATED: 'plus',
  UPDATED: 'pencil',
  ASSIGNED: 'user',
  STATUS_CHANGED: 'refresh',
};

/**
 * Línea de tiempo del historial de una incidencia (CA-04.9): una lista ordenada (`<ol>`) con un
 * elemento por evento, en el orden en que llegan (la API los da del más antiguo al más reciente).
 *
 * Cada evento muestra el autor, la frase en español de `describeEvent` ("cambió el estado de
 * Abierta a En curso"), la fecha y hora (`dd/mm/aaaa HH:mm` en `Europe/Madrid`, en un `<time>`) y,
 * si es un cambio de estado con comentario, el comentario en un bloque citado que respeta los
 * saltos de línea.
 *
 * Presentacional: la página carga los eventos y gestiona la carga y el error.
 */
export interface IncidentTimelineProps {
  /** Eventos de `GET /api/incidents/:id/events`, en orden cronológico. */
  events: IncidentEvent[];
  /** Nombre accesible de la lista. */
  label?: string;
  className?: string;
}

export function IncidentTimeline({
  events,
  label = 'Historial de la incidencia',
  className,
}: IncidentTimelineProps) {
  // Toda incidencia tiene al menos su evento de alta; por si acaso, un texto en lugar de nada.
  if (events.length === 0) {
    return (
      <Text variant="muted" className={className}>
        Todavía no hay eventos en el historial.
      </Text>
    );
  }

  return (
    <ol aria-label={label} className={cn('flex flex-col', className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const comment = event.type === 'STATUS_CHANGED' ? event.data.comment : null;
        return (
          <li key={event.id} className="flex gap-3">
            <div aria-hidden="true" className="flex flex-col items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-neutral-bg text-fg-muted">
                <Icon name={EVENT_ICONS[event.type]} size="sm" />
              </span>
              {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col gap-1 pt-1', !isLast && 'pb-6')}>
              <p className="text-base break-words text-fg">
                <span className="font-semibold">{event.actor.name}</span> {describeEvent(event)}
              </p>
              <Text variant="small">
                <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
              </Text>
              {comment && (
                <blockquote className="mt-1 rounded-md border-l-4 border-border-strong bg-neutral-bg px-3 py-2 text-sm break-words whitespace-pre-line text-fg">
                  <span className="sr-only">Comentario: </span>
                  {comment}
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
