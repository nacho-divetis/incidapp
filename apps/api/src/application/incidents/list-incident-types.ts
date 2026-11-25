import type { IncidentTypeSummary } from '@incidapp/shared';
import type { IncidentTypeRepository } from '../ports/incident-type-repository';

export interface ListIncidentTypesDeps {
  incidentTypes: IncidentTypeRepository;
}

export type ListIncidentTypes = () => Promise<IncidentTypeSummary[]>;

/**
 * `GET /api/incident-types` (CA-03.1): el catálogo fijo con su departamento por defecto, ordenado
 * por nombre. Lo puede leer cualquier usuario con sesión (la exige la ruta): no depende del rol.
 */
export const makeListIncidentTypes =
  ({ incidentTypes }: ListIncidentTypesDeps): ListIncidentTypes =>
  () =>
    incidentTypes.list();
