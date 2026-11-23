// Hooks de TanStack Query para el estado de la API.
import { HealthResponse } from '@incidapp/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api/client';

export const healthKeys = {
  all: ['health'] as const,
};

/** Estado de la API y de la base de datos (`GET /api/health`). */
export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: () => apiGet('/health', HealthResponse),
  });
}
