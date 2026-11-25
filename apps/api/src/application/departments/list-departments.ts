import type { DepartmentSummary } from '@incidapp/shared';
import type { DepartmentRepository } from '../ports/department-repository';

export interface ListDepartmentsDeps {
  departments: DepartmentRepository;
}

export type ListDepartments = () => Promise<DepartmentSummary[]>;

/**
 * `GET /api/departments` (CA-02.14): el catálogo fijo, ordenado por nombre. Lo puede leer cualquier
 * usuario con sesión (la exige la ruta): no depende del rol, así que no consulta la política.
 */
export const makeListDepartments =
  ({ departments }: ListDepartmentsDeps): ListDepartments =>
  () =>
    departments.list();
