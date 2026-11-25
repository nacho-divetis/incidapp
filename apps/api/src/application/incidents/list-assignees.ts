import type { CurrentUser, UserSummary } from '@incidapp/shared';
import type { IncidentRepository } from '../ports/incident-repository';
import type { UserAdminRepository } from '../ports/user-admin-repository';
import { findIncidentForAction } from './incident-support';

export interface ListAssigneesDeps {
  incidents: IncidentRepository;
  users: UserAdminRepository;
}

export type ListAssignees = (actor: CurrentUser, id: string) => Promise<UserSummary[]>;

/**
 * `GET /api/incidents/:id/assignees` (CA-03.10): 404 si no es visible; 403 sin permiso de asignar.
 * Los candidatos son los usuarios activos del departamento propietario (nota ¹).
 */
export const makeListAssignees =
  ({ incidents, users }: ListAssigneesDeps): ListAssignees =>
  async (actor, id) => {
    const incident = await findIncidentForAction(incidents, actor, id, 'assign');
    return users.listActiveByDepartment(incident.department.id);
  };
