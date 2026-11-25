import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { jsonResponse, mockApi } from '../test/api-mock';
import { INCIDENT_TYPE_LIST } from '../test/incident-fixtures';
import { incidentTypeKeys, useIncidentTypes } from './incident-types';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useIncidentTypes', () => {
  it('pide GET /api/incident-types una sola vez y no caduca', async () => {
    const api = mockApi({
      'GET /api/incident-types': () => jsonResponse(200, INCIDENT_TYPE_LIST),
    });
    const { queryClient, wrapper } = setup();

    const first = renderHook(() => useIncidentTypes(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(INCIDENT_TYPE_LIST));
    const second = renderHook(() => useIncidentTypes(), { wrapper });

    expect(second.result.current.data).toEqual(INCIDENT_TYPE_LIST);
    expect(api.callsTo('GET /api/incident-types')).toHaveLength(1);
    expect(queryClient.getQueryState(incidentTypeKeys.list)?.isInvalidated).toBe(false);
  });

  it('una respuesta sin la forma del contrato es un error', async () => {
    mockApi({ 'GET /api/incident-types': () => jsonResponse(200, [{ id: 'x' }]) });
    const { wrapper } = setup();

    const { result } = renderHook(() => useIncidentTypes(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
