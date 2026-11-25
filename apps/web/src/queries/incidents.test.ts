import type { IncidentListResponse } from '@incidapp/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/client';
import { errorResponse, jsonResponse, mockApi } from '../test/api-mock';
import {
  INCIDENT,
  INCIDENT_DEPARTMENTS,
  INCIDENT_LIST_ITEMS,
  INCIDENT_TYPES,
  PEOPLE,
} from '../test/incident-fixtures';
import {
  incidentKeys,
  incidentListSearch,
  useAssignIncident,
  useCreateIncident,
  useIncident,
  useIncidentAssignees,
  useIncidents,
  useUpdateIncident,
} from './incidents';

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

const PAGE_1: IncidentListResponse = {
  items: INCIDENT_LIST_ITEMS,
  total: 3,
  page: 1,
  pageSize: 20,
};

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated ?? false;

describe('incidentListSearch', () => {
  it('sin filtros solo lleva la página', () => {
    expect(incidentListSearch({}, 1)).toBe('page=1');
    expect(incidentListSearch({ assignedToMe: false, q: '   ' }, 2)).toBe('page=2');
  });

  it('lleva los filtros en un orden fijo, con el texto recortado y codificado', () => {
    expect(
      incidentListSearch(
        {
          q: '  palé roto ',
          assignedToMe: true,
          departmentId: INCIDENT_DEPARTMENTS.LOG.id,
          priority: 'HIGH',
          status: 'OPEN',
        },
        3,
      ),
    ).toBe(
      `status=OPEN&priority=HIGH&departmentId=${INCIDENT_DEPARTMENTS.LOG.id}&assignedToMe=true&q=pal%C3%A9+roto&page=3`,
    );
  });

  it('filtros equivalentes comparten la clave de caché', () => {
    expect(incidentKeys.list({ assignedToMe: false, q: ' ' }, 1)).toEqual(incidentKeys.list({}, 1));
  });
});

describe('useIncidents', () => {
  it('pide GET /api/incidents con los filtros y la página', async () => {
    const api = mockApi({
      'GET /api/incidents?status=OPEN&page=1': () => jsonResponse(200, PAGE_1),
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useIncidents({ status: 'OPEN' }, 1), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(PAGE_1));
    expect(api.callsTo('GET /api/incidents?status=OPEN&page=1')).toHaveLength(1);
  });

  it('mientras llega otra página conserva la anterior como provisional', async () => {
    const page2 = { ...PAGE_1, items: [], page: 2, total: 21 };
    let release: (response: Response) => void = () => {};
    mockApi({
      'GET /api/incidents?page=1': () => jsonResponse(200, PAGE_1),
      'GET /api/incidents?page=2': () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ page }) => useIncidents({}, page), {
      wrapper,
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(result.current.data).toEqual(PAGE_1));

    rerender({ page: 2 });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual(PAGE_1);
    act(() => release(jsonResponse(200, page2)));
    await waitFor(() => expect(result.current.data).toEqual(page2));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});

describe('useIncident y useIncidentAssignees', () => {
  it('piden el detalle con el id codificado', async () => {
    const api = mockApi({
      'GET /api/incidents/a%2Fb': () => errorResponse(404, 'NOT_FOUND', 'No encontrada.'),
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useIncident('a/b'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(404);
    expect(api.callsTo('GET /api/incidents/a%2Fb')).toHaveLength(1);
  });

  it('los candidatos solo se piden con `enabled`', async () => {
    const route = `GET /api/incidents/${INCIDENT.id}/assignees`;
    const api = mockApi({ [route]: () => jsonResponse(200, [PEOPLE.MARTA]) });
    const { wrapper } = setup();

    const { result, rerender } = renderHook(
      ({ enabled }) => useIncidentAssignees(INCIDENT.id, { enabled }),
      { wrapper, initialProps: { enabled: false } },
    );
    await act(() => Promise.resolve());
    expect(api.callsTo(route)).toHaveLength(0);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toEqual([PEOPLE.MARTA]));
  });
});

describe('mutaciones', () => {
  it('useCreateIncident hace POST /api/incidents, guarda el detalle e invalida los listados', async () => {
    const api = mockApi({ 'POST /api/incidents': () => jsonResponse(201, INCIDENT) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(incidentKeys.list({}, 1), PAGE_1);
    const { result } = renderHook(() => useCreateIncident(), { wrapper });
    const input = {
      title: INCIDENT.title,
      description: INCIDENT.description,
      typeId: INCIDENT_TYPES.TRANSPORT.id,
      priority: 'HIGH' as const,
    };

    await act(() => result.current.mutateAsync(input));

    const [request] = api.callsTo('POST /api/incidents');
    expect(JSON.parse(String(request?.init.body))).toEqual(input);
    expect(new Headers(request?.init.headers).get('X-Requested-With')).toBe('fetch');
    expect(queryClient.getQueryData(incidentKeys.detail(INCIDENT.id))).toEqual(INCIDENT);
    expect(isStale(queryClient, incidentKeys.list({}, 1))).toBe(true);
  });

  it('useUpdateIncident hace PATCH /api/incidents/:id y actualiza la caché', async () => {
    const saved = { ...INCIDENT, title: 'Título nuevo' };
    const api = mockApi({
      [`PATCH /api/incidents/${INCIDENT.id}`]: () => jsonResponse(200, saved),
    });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(incidentKeys.detail(INCIDENT.id), INCIDENT);
    queryClient.setQueryData(incidentKeys.list({ status: 'OPEN' }, 2), PAGE_1);
    const { result } = renderHook(() => useUpdateIncident(INCIDENT.id), { wrapper });

    await act(() => result.current.mutateAsync({ title: 'Título nuevo', dueDate: null }));

    const [request] = api.callsTo(`PATCH /api/incidents/${INCIDENT.id}`);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      title: 'Título nuevo',
      dueDate: null,
    });
    expect(queryClient.getQueryData(incidentKeys.detail(INCIDENT.id))).toEqual(saved);
    expect(isStale(queryClient, incidentKeys.detail(INCIDENT.id))).toBe(false);
    expect(isStale(queryClient, incidentKeys.list({ status: 'OPEN' }, 2))).toBe(true);
  });

  it('useAssignIncident hace POST /api/incidents/:id/assign con `assigneeId`', async () => {
    const saved = { ...INCIDENT, assignee: PEOPLE.PABLO };
    const api = mockApi({
      [`POST /api/incidents/${INCIDENT.id}/assign`]: () => jsonResponse(200, saved),
    });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useAssignIncident(INCIDENT.id), { wrapper });

    await act(() => result.current.mutateAsync(PEOPLE.PABLO.id));

    const [request] = api.callsTo(`POST /api/incidents/${INCIDENT.id}/assign`);
    expect(JSON.parse(String(request?.init.body))).toEqual({ assigneeId: PEOPLE.PABLO.id });
    expect(queryClient.getQueryData(incidentKeys.detail(INCIDENT.id))).toEqual(saved);
  });

  it('un error de la API no toca la caché', async () => {
    mockApi({
      [`POST /api/incidents/${INCIDENT.id}/assign`]: () =>
        errorResponse(403, 'FORBIDDEN', 'No tienes permiso para hacer esta acción.'),
    });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(incidentKeys.detail(INCIDENT.id), INCIDENT);
    const { result } = renderHook(() => useAssignIncident(INCIDENT.id), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(PEOPLE.PABLO.id).catch(() => undefined);
    });

    await waitFor(() =>
      expect(result.current.error?.message).toBe('No tienes permiso para hacer esta acción.'),
    );
    expect(queryClient.getQueryData(incidentKeys.detail(INCIDENT.id))).toEqual(INCIDENT);
  });
});
