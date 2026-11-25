import type { CurrentUser, IncidentEvent } from '@incidapp/shared';
import type { IncidentEventReader } from '../ports/incident-event-reader';
import type { IncidentRepository } from '../ports/incident-repository';
import { findIncidentForAction } from './incident-support';

export interface ListIncidentEventsDeps {
  incidents: IncidentRepository;
  incidentEvents: IncidentEventReader;
}

export type ListIncidentEvents = (actor: CurrentUser, id: string) => Promise<IncidentEvent[]>;

/**
 * `GET /api/incidents/:id/events` (CA-04.6): 404 si no existe, no es un UUID o no es visible; si no,
 * el historial en orden cronológico (el más antiguo primero), con el actor y la fecha ISO.
 */
export const makeListIncidentEvents =
  ({ incidents, incidentEvents }: ListIncidentEventsDeps): ListIncidentEvents =>
  async (actor, id) => {
    const incident = await findIncidentForAction(incidents, actor, id, 'view');
    const events = await incidentEvents.listByIncident(incident.id);
    return events.map((event): IncidentEvent => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    }));
  };
