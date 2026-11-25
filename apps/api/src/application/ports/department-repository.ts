import type { DepartmentSummary } from '@incidapp/shared';

/** Puerto de lectura del catálogo de departamentos (tabla `departments`, fija desde el *seed*). */
export interface DepartmentRepository {
  /** Todos los departamentos, ordenados por nombre. */
  list(): Promise<DepartmentSummary[]>;
  /** Los departamentos que existen de entre `ids` (los que no existen no aparecen). */
  findByIds(ids: readonly string[]): Promise<DepartmentSummary[]>;
}
