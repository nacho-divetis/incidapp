import type { IncidentEventWriter } from '../../../application/ports/incident-event-writer';
import type { Database } from '../client';
import { incidentEvents } from '../schema';

/**
 * Adaptador Drizzle de `IncidentEventWriter`. Solo inserta: `incident_events` no se actualiza ni se
 * borra.
 */
export function createDrizzleIncidentEventWriter(db: Database): IncidentEventWriter {
  return {
    async append(event) {
      await db.insert(incidentEvents).values({
        incidentId: event.incidentId,
        type: event.type,
        actorId: event.actorId,
        data: event.data,
        createdAt: event.createdAt,
      });
    },
  };
}
