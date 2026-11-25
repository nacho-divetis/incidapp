import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { jsonResponse, mockApi } from '../test/api-mock';
import { DEPARTMENTS } from '../test/user-fixtures';
import { departmentKeys, useDepartments } from './departments';

describe('useDepartments', () => {
  it('pide GET /api/departments y el catálogo no caduca', async () => {
    const api = mockApi({ 'GET /api/departments': () => jsonResponse(200, DEPARTMENTS) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useDepartments(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(DEPARTMENTS));
    expect(api.callsTo('GET /api/departments')).toHaveLength(1);
    expect(queryClient.getQueryCache().find({ queryKey: departmentKeys.list })?.isStale()).toBe(
      false,
    );
  });
});
