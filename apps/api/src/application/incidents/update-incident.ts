import type { CurrentUser, Incident, UpdateIncidentInput } from '@incidapp/shared';
import { diffIncidentFields } from '../../domain/incidents/incident-changes';
import type { Clock } from '../ports/clock';
import type { IncidentChanges } from '../ports/incident-repository';
import type { UnitOfWork } from '../ports/unit-of-work';
import { lockIncidentForAction, presentIncident } from './incident-support';

export interface UpdateIncidentDeps {
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export interface UpdateIncidentCommand {
  actor: CurrentUser;
  id: string;
  /** Edición ya validada y normalizada con `UpdateIncidentInput`. */
  input: UpdateIncidentInput;
}

export type UpdateIncident = (command: UpdateIncidentCommand) => Promise<Incident>;

/**
 * `PATCH /api/incidents/:id` (CA-03.9): 404 si no es visible; 403 sin permiso de editar campos. Solo
 * cuenta lo que cambia: si nada cambia, devuelve la incidencia sin escribir; si no, guarda los
 * cambios y su evento `UPDATED` (antes y después de cada campo). Todo en una transacción, con la
 * incidencia bloqueada desde la lectura en la que se decide (`lockIncidentForAction`).
 */
export const makeUpdateIncident =
  ({ unitOfWork, clock }: UpdateIncidentDeps): UpdateIncident =>
  async ({ actor, id, input }) => {
    const result = await unitOfWork.run(async (tx) => {
      const incident = await lockIncidentForAction(tx.incidents, actor, id, 'update');

      const changes = diffIncidentFields(incident, input);
      if (changes.length === 0) return incident;

      const now = clock.now();
      const fields: IncidentChanges = { updatedAt: now };
      for (const change of changes) Object.assign(fields, { [change.field]: change.after });

      const updated = await tx.incidents.update(incident.id, fields);
      await tx.incidentEvents.append({
        incidentId: incident.id,
        type: 'UPDATED',
        data: { changes },
        actorId: actor.id,
        createdAt: now,
      });
      return updated;
    });

    return presentIncident(actor, result);
  };
