import type { CurrentUser, Incident } from '@incidapp/shared';
import type { IncidentRepository } from '../ports/incident-repository';
import { findIncidentForAction, presentIncident } from './incident-support';

export interface GetIncidentDeps {
  incidents: IncidentRepository;
}

export type GetIncident = (actor: CurrentUser, id: string) => Promise<Incident>;

/** `GET /api/incidents/:id` (CA-03.6): 404 si no existe, no es un UUID o no es visible. */
export const makeGetIncident =
  ({ incidents }: GetIncidentDeps): GetIncident =>
  async (actor, id) =>
    presentIncident(actor, await findIncidentForAction(incidents, actor, id, 'view'));
