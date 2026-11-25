// Hooks de TanStack Query del catálogo de tipos de incidencia.
import { IncidentTypeSummary } from '@incidapp/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '../lib/api/client';

export const incidentTypeKeys = {
  list: ['incident-types'] as const,
};

const IncidentTypeList = z.array(IncidentTypeSummary);

/**
 * Catálogo de tipos de incidencia con su departamento (`GET /api/incident-types`). Es fijo (lo carga
 * el *seed*), así que no caduca mientras dura la sesión; cerrar sesión vacía la caché.
 */
export function useIncidentTypes() {
  return useQuery({
    queryKey: incidentTypeKeys.list,
    queryFn: () => apiGet('/incident-types', IncidentTypeList),
    staleTime: Infinity,
  });
}
