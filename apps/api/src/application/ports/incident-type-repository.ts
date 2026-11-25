import type { IncidentTypeSummary } from '@incidapp/shared';

/** Puerto de lectura del catálogo de tipos de incidencia (tabla `incident_types`, fija desde el *seed*). */
export interface IncidentTypeRepository {
  /** Todos los tipos con su departamento por defecto, ordenados por nombre. */
  list(): Promise<IncidentTypeSummary[]>;
  /** El tipo con ese id, o `null` si no existe (también si `id` no es un UUID). */
  findById(id: string): Promise<IncidentTypeSummary | null>;
}
