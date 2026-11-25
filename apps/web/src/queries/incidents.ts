// Hooks de TanStack Query de las incidencias (`/api/incidents…`).
import {
  Incident,
  IncidentListResponse,
  UserSummary,
  type CreateIncidentInput,
  type IncidentListQuery,
  type UpdateIncidentInput,
} from '@incidapp/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiSend } from '../lib/api/client';

/**
 * Filtros del listado (los de `IncidentListQuery` sin la página). "Asignadas a mí" desactivado y el
 * buscador vacío equivalen a no filtrar.
 */
export type IncidentListFilters = Omit<IncidentListQuery, 'page'>;

export const incidentKeys = {
  /** Prefijo de todas las claves de incidencias. */
  all: ['incidents'] as const,
  /** Prefijo de todas las páginas del listado (lo que se invalida tras una mutación). */
  lists: ['incidents', 'list'] as const,
  /** Una página del listado con sus filtros ya normalizados. */
  list: (filters: IncidentListFilters, page: number) =>
    ['incidents', 'list', normalizeFilters(filters), page] as const,
  /** Una incidencia (`GET /api/incidents/:id`). */
  detail: (id: string) => ['incidents', id] as const,
  /** Candidatos a asignar una incidencia (`GET /api/incidents/:id/assignees`). */
  assignees: (id: string) => ['incidents', id, 'assignees'] as const,
};

/**
 * Quita los filtros que no filtran (vacíos, "Asignadas a mí" desactivado, buscador con solo
 * espacios), para que filtros equivalentes compartan la misma clave de caché y la misma petición.
 */
function normalizeFilters(filters: IncidentListFilters): IncidentListFilters {
  const normalized: IncidentListFilters = {};
  if (filters.status) normalized.status = filters.status;
  if (filters.priority) normalized.priority = filters.priority;
  if (filters.departmentId) normalized.departmentId = filters.departmentId;
  if (filters.assignedToMe) normalized.assignedToMe = true;
  const q = filters.q?.trim();
  if (q) normalized.q = q;
  return normalized;
}

/** *Query string* de `GET /api/incidents` (en un orden fijo; la página va siempre). */
export function incidentListSearch(filters: IncidentListFilters, page: number): string {
  const normalized = normalizeFilters(filters);
  const params = new URLSearchParams();
  if (normalized.status) params.set('status', normalized.status);
  if (normalized.priority) params.set('priority', normalized.priority);
  if (normalized.departmentId) params.set('departmentId', normalized.departmentId);
  if (normalized.assignedToMe) params.set('assignedToMe', 'true');
  if (normalized.q) params.set('q', normalized.q);
  params.set('page', String(page));
  return params.toString();
}

function incidentPath(id: string): string {
  return `/incidents/${encodeURIComponent(id)}`;
}

const AssigneeList = z.array(UserSummary);

/**
 * Tras una mutación que devuelve la incidencia: guarda la respuesta en su detalle (la página la
 * muestra sin otra petición) e invalida todas las páginas del listado.
 */
function storeIncident(queryClient: QueryClient, incident: Incident): void {
  queryClient.setQueryData(incidentKeys.detail(incident.id), incident);
  void queryClient.invalidateQueries({ queryKey: incidentKeys.lists });
}

/**
 * Una página del listado de incidencias visibles (CA-03.12). Mientras llega una página nueva (otro
 * filtro u otra página) se sigue mostrando la anterior (`isPlaceholderData`), sin parpadeos.
 */
export function useIncidents(filters: IncidentListFilters, page: number) {
  return useQuery({
    queryKey: incidentKeys.list(filters, page),
    queryFn: () => apiGet(`/incidents?${incidentListSearch(filters, page)}`, IncidentListResponse),
    placeholderData: keepPreviousData,
  });
}

/** Una incidencia con sus `allowedActions` (CA-03.14). */
export function useIncident(id: string) {
  return useQuery({
    queryKey: incidentKeys.detail(id),
    queryFn: () => apiGet(incidentPath(id), Incident),
  });
}

/**
 * Usuarios a los que se puede asignar la incidencia. Solo se pide con `enabled` (cuando
 * `allowedActions` incluye `assign`): sin la acción, la API respondería 403.
 */
export function useIncidentAssignees(id: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: incidentKeys.assignees(id),
    queryFn: () => apiGet(`${incidentPath(id)}/assignees`, AssigneeList),
    enabled,
  });
}

/** Alta de una incidencia (`POST /api/incidents`). */
export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIncidentInput) => apiSend('POST', '/incidents', Incident, input),
    onSuccess: (incident) => storeIncident(queryClient, incident),
  });
}

/** Edición de una incidencia (`PATCH /api/incidents/:id`). */
export function useUpdateIncident(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIncidentInput) => apiSend('PATCH', incidentPath(id), Incident, input),
    onSuccess: (incident) => storeIncident(queryClient, incident),
  });
}

/** Asignación de una incidencia (`POST /api/incidents/:id/assign`). */
export function useAssignIncident(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assigneeId: string) =>
      apiSend('POST', `${incidentPath(id)}/assign`, Incident, { assigneeId }),
    onSuccess: (incident) => storeIncident(queryClient, incident),
  });
}
