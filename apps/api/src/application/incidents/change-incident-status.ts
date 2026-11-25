import type { CurrentUser, Incident, TransitionInput } from '@incidapp/shared';
import {
  findTransition,
  InvalidTransitionError,
  type StatusTransition,
} from '../../domain/incidents/status-machine';
import { ConflictError, ValidationError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IncidentChanges, IncidentRecord } from '../ports/incident-repository';
import type { UnitOfWork } from '../ports/unit-of-work';
import { COMMENT_REQUIRED_MESSAGE } from './incident-messages';
import {
  assertCanOnIncident,
  lockIncidentForAction,
  presentIncident,
  transitionActionOf,
} from './incident-support';
import { STATUS_LABELS } from './status-labels';

export interface ChangeIncidentStatusDeps {
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export interface ChangeIncidentStatusCommand {
  actor: CurrentUser;
  id: string;
  /** Cambio de estado ya validado y normalizado con `TransitionInput`. */
  input: TransitionInput;
}

export type ChangeIncidentStatus = (command: ChangeIncidentStatusCommand) => Promise<Incident>;

/** La transición de la máquina de estados, o 409 con los estados en español si no existe. */
function transitionOf(incident: IncidentRecord, to: TransitionInput['to']): StatusTransition {
  try {
    return findTransition(incident.status, to);
  } catch (error) {
    if (!(error instanceof InvalidTransitionError)) throw error;
    throw new ConflictError(
      `No se puede pasar de ${STATUS_LABELS[error.from]} a ${STATUS_LABELS[error.to]}.`,
    );
  }
}

/**
 * `POST /api/incidents/:id/transitions` (CA-04.2, CA-04.3). Orden de los errores (decisión 2):
 * 404 si no es visible → 409 si la transición no existe desde el estado actual → 403 si el actor no
 * puede hacer su tipo → 400 si exige comentario y no lo trae. Todo en una transacción con la
 * incidencia bloqueada desde la lectura en la que se decide (`lockIncidentForAction`): el estado de
 * origen del evento es el de esa lectura. Guarda el estado nuevo, `resolvedAt`/`closedAt` al entrar
 * en RESUELTA/CERRADA (la última fecha) y el evento `STATUS_CHANGED`.
 */
export const makeChangeIncidentStatus =
  ({ unitOfWork, clock }: ChangeIncidentStatusDeps): ChangeIncidentStatus =>
  async ({ actor, id, input }) => {
    const result = await unitOfWork.run(async (tx) => {
      const incident = await lockIncidentForAction(tx.incidents, actor, id, 'view');
      const transition = transitionOf(incident, input.to);
      assertCanOnIncident(actor, incident, transitionActionOf(transition));
      if (transition.requiresComment && input.comment === undefined) {
        throw new ValidationError(COMMENT_REQUIRED_MESSAGE, [
          { path: 'comment', message: COMMENT_REQUIRED_MESSAGE },
        ]);
      }

      const now = clock.now();
      const changes: IncidentChanges = { status: transition.to, updatedAt: now };
      if (transition.to === 'RESOLVED') changes.resolvedAt = now;
      if (transition.to === 'CLOSED') changes.closedAt = now;

      const updated = await tx.incidents.update(incident.id, changes);
      await tx.incidentEvents.append({
        incidentId: incident.id,
        type: 'STATUS_CHANGED',
        data: { from: transition.from, to: transition.to, comment: input.comment ?? null },
        actorId: actor.id,
        createdAt: now,
      });
      return updated;
    });

    return presentIncident(actor, result);
  };
