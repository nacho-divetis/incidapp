import { asc, eq } from 'drizzle-orm';
import type {
  IncidentEventReader,
  IncidentEventRecord,
} from '../../../application/ports/incident-event-reader';
import type { IncidentEventPayload } from '../../../application/ports/incident-event-writer';
import type { Database } from '../client';
import { incidentEvents, users } from '../schema';
import { isUuid } from './uuid';

/**
 * Adaptador Drizzle de `IncidentEventReader`. Solo lee: `incident_events` no se actualiza ni se
 * borra. Orden cronológico con el índice (`incident_id`, `created_at`) y desempate por `id`.
 */
export function createDrizzleIncidentEventReader(db: Database): IncidentEventReader {
  return {
    async listByIncident(incidentId) {
      if (!isUuid(incidentId)) return [];
      const rows = await db
        .select({
          id: incidentEvents.id,
          type: incidentEvents.type,
          data: incidentEvents.data,
          actorId: users.id,
          actorName: users.name,
          createdAt: incidentEvents.createdAt,
        })
        .from(incidentEvents)
        .innerJoin(users, eq(users.id, incidentEvents.actorId))
        .where(eq(incidentEvents.incidentId, incidentId))
        .orderBy(asc(incidentEvents.createdAt), asc(incidentEvents.id));

      return rows.map((row): IncidentEventRecord => ({
        id: row.id,
        // `data` es `jsonb`: solo lo escribe `IncidentEventWriter` con el tipo de su evento, y la
        // ruta valida la respuesta con `IncidentEventList`.
        ...({ type: row.type, data: row.data } as IncidentEventPayload),
        actor: { id: row.actorId, name: row.actorName },
        createdAt: row.createdAt,
      }));
    },
  };
}
