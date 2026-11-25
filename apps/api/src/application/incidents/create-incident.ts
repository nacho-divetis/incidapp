import type { CreateIncidentInput, CurrentUser, Incident } from '@incidapp/shared';
import { formatIncidentCode, incidentYear } from '../../domain/incidents/incident-code';
import { ValidationError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IncidentTypeRepository } from '../ports/incident-type-repository';
import type { UnitOfWork } from '../ports/unit-of-work';
import { UNKNOWN_INCIDENT_TYPE_MESSAGE } from './incident-messages';
import { assertCanCreateIncident, presentIncident } from './incident-support';

export interface CreateIncidentDeps {
  incidentTypes: IncidentTypeRepository;
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export interface CreateIncidentCommand {
  actor: CurrentUser;
  /** Alta ya validada y normalizada con `CreateIncidentInput`. */
  input: CreateIncidentInput;
}

export type CreateIncident = (command: CreateIncidentCommand) => Promise<Incident>;

/**
 * `POST /api/incidents` (CA-03.2 a CA-03.5): 403 sin `createIncident`; 400 si el tipo no existe (sin
 * consumir código). En una sola transacción: siguiente número del año de Madrid, alta ABIERTA en el
 * departamento del tipo, creada por el actor, y su evento `CREATED`.
 */
export const makeCreateIncident =
  ({ incidentTypes, unitOfWork, clock }: CreateIncidentDeps): CreateIncident =>
  async ({ actor, input }) => {
    assertCanCreateIncident(actor);
    const type = await incidentTypes.findById(input.typeId);
    if (!type) {
      throw new ValidationError(undefined, [
        { path: 'typeId', message: UNKNOWN_INCIDENT_TYPE_MESSAGE },
      ]);
    }

    const now = clock.now();
    const created = await unitOfWork.run(async (tx) => {
      const year = incidentYear(now);
      const number = await tx.incidentCodes.next(year);
      const incident = await tx.incidents.create({
        code: formatIncidentCode(year, number),
        title: input.title,
        description: input.description,
        typeId: type.id,
        departmentId: type.department.id,
        priority: input.priority,
        status: 'OPEN',
        createdById: actor.id,
        dueDate: input.dueDate ?? null,
        createdAt: now,
      });
      await tx.incidentEvents.append({
        incidentId: incident.id,
        type: 'CREATED',
        data: {},
        actorId: actor.id,
        createdAt: now,
      });
      return incident;
    });

    return presentIncident(actor, created);
  };
