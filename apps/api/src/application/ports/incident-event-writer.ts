import type { IncidentEvent } from '@incidapp/shared';

/** `type` y `data` de un evento del contrato, conservando la relación entre ambos. */
type EventPayload<E> = E extends IncidentEvent ? Pick<E, 'type' | 'data'> : never;

/** Evento nuevo del historial. El actor y la fecha los decide el servidor. */
export type NewIncidentEvent = EventPayload<IncidentEvent> & {
  incidentId: string;
  actorId: string;
  createdAt: Date;
};

/**
 * Puerto de escritura del historial. `incident_events` es **solo de inserción**: este puerto solo
 * ofrece `append`, sin operaciones para actualizar ni borrar.
 */
export interface IncidentEventWriter {
  append(event: NewIncidentEvent): Promise<void>;
}
