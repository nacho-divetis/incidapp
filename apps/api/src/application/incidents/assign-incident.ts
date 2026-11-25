import type { AssignIncidentInput, CurrentUser, Incident } from '@incidapp/shared';
import { ValidationError } from '../errors';
import type { Clock } from '../ports/clock';
import type { UnitOfWork } from '../ports/unit-of-work';
import { INVALID_ASSIGNEE_MESSAGE } from './incident-messages';
import { lockIncidentForAction, presentIncident } from './incident-support';

export interface AssignIncidentDeps {
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export interface AssignIncidentCommand {
  actor: CurrentUser;
  id: string;
  /** Asignación ya validada con `AssignIncidentInput`. */
  input: AssignIncidentInput;
}

export type AssignIncident = (command: AssignIncidentCommand) => Promise<Incident>;

/**
 * `POST /api/incidents/:id/assign` (CA-03.10): 404 si no es visible; 403 sin permiso de asignar;
 * 400 si el asignado no es un usuario activo del departamento propietario (nota ¹, decisión 4).
 * Asignar al mismo usuario no escribe nada; si cambia, se guarda con su evento `ASSIGNED` (anterior
 * y nuevo). Todo en una transacción: la incidencia se bloquea desde la lectura en la que se decide
 * (`lockIncidentForAction`) y el candidato se comprueba dentro de ella.
 */
export const makeAssignIncident =
  ({ unitOfWork, clock }: AssignIncidentDeps): AssignIncident =>
  async ({ actor, id, input }) => {
    const result = await unitOfWork.run(async (tx) => {
      const incident = await lockIncidentForAction(tx.incidents, actor, id, 'assign');

      const candidates = await tx.users.listActiveByDepartment(incident.department.id);
      const assignee = candidates.find((candidate) => candidate.id === input.assigneeId);
      if (!assignee) {
        throw new ValidationError(INVALID_ASSIGNEE_MESSAGE, [
          { path: 'assigneeId', message: INVALID_ASSIGNEE_MESSAGE },
        ]);
      }
      if (incident.assignee?.id === assignee.id) return incident;

      const now = clock.now();
      const updated = await tx.incidents.update(incident.id, {
        assignedToId: assignee.id,
        updatedAt: now,
      });
      await tx.incidentEvents.append({
        incidentId: incident.id,
        type: 'ASSIGNED',
        data: { from: incident.assignee, to: assignee },
        actorId: actor.id,
        createdAt: now,
      });
      return updated;
    });

    return presentIncident(actor, result);
  };
