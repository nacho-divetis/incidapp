// Hooks de TanStack Query del catálogo de departamentos.
import { DepartmentSummary } from '@incidapp/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../lib/api/client';

export const departmentKeys = {
  list: ['departments'] as const,
};

const DepartmentList = z.array(DepartmentSummary);

/**
 * Catálogo de departamentos (`GET /api/departments`). Es fijo (lo carga el *seed*), así que no
 * caduca mientras dura la sesión; cerrar sesión vacía la caché.
 */
export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.list,
    queryFn: () => apiGet('/departments', DepartmentList),
    staleTime: Infinity,
  });
}
