import {
  INCIDENTS_PAGE_SIZE,
  type CurrentUser,
  type IncidentListQuery,
  type IncidentListResponse,
} from '@incidapp/shared';
import { actorOf, incidentVisibilityScope } from '../authorization/authorization-policy';
import type { IncidentRepository } from '../ports/incident-repository';
import { presentIncidentListItem } from './incident-support';

export interface ListIncidentsDeps {
  incidents: IncidentRepository;
}

export type ListIncidents = (
  actor: CurrentUser,
  query: IncidentListQuery,
) => Promise<IncidentListResponse>;

/**
 * `GET /api/incidents` (CA-03.7, CA-03.8): una página de las incidencias **visibles** para el actor.
 * Qué ve lo decide la política (`incidentVisibilityScope`); los filtros solo lo reducen.
 */
export const makeListIncidents =
  ({ incidents }: ListIncidentsDeps): ListIncidents =>
  async (actor, query) => {
    const { items, total } = await incidents.list({
      scope: incidentVisibilityScope(actorOf(actor)),
      filters: {
        status: query.status,
        priority: query.priority,
        departmentId: query.departmentId,
        assignedToId: query.assignedToMe ? actor.id : undefined,
        q: query.q,
      },
      page: query.page,
      pageSize: INCIDENTS_PAGE_SIZE,
    });
    return {
      items: items.map(presentIncidentListItem),
      total,
      page: query.page,
      pageSize: INCIDENTS_PAGE_SIZE,
    };
  };
