import type { UserSummary } from '@incidapp/shared';
import type { IncidentEventPayload } from './incident-event-writer';

/** Evento del historial tal como lo lee el repositorio: con su id, el actor resuelto y la fecha. */
export type IncidentEventRecord = IncidentEventPayload & {
  id: string;
  actor: UserSummary;
  createdAt: Date;
};

/**
 * Puerto de lectura del historial (CA-04.6). `incident_events` es **solo de inserción**: este puerto
 * solo lee, sin operaciones para actualizar ni borrar (CA-04.5).
 */
export interface IncidentEventReader {
  /** Los eventos de la incidencia, del más antiguo al más reciente (`id` como desempate). */
  listByIncident(incidentId: string): Promise<IncidentEventRecord[]>;
}
