import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/client';
import { DEMO_ADMIN, errorResponse, jsonResponse, mockApi } from '../test/api-mock';
import { DEPARTMENTS, LUCIA, SELF_ADMIN, deactivated } from '../test/user-fixtures';
import { authKeys } from './auth';
import {
  useCreateUser,
  useResetUserPassword,
  useSetUserActive,
  useUpdateUser,
  useUser,
  useUsers,
  userKeys,
} from './users';

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

const isStale = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated ?? false;

describe('useUsers y useUser', () => {
  it('piden GET /api/users y GET /api/users/:id', async () => {
    mockApi({
      'GET /api/users': () => jsonResponse(200, [LUCIA]),
      [`GET /api/users/${LUCIA.id}`]: () => jsonResponse(200, LUCIA),
    });
    const { wrapper } = setup();

    const list = renderHook(() => useUsers(), { wrapper });
    const detail = renderHook(() => useUser(LUCIA.id), { wrapper });

    await waitFor(() => expect(list.result.current.data).toEqual([LUCIA]));
    await waitFor(() => expect(detail.result.current.data).toEqual(LUCIA));
  });

  it('un 403 es un error con el mensaje de la API', async () => {
    mockApi({
      'GET /api/users': () => errorResponse(403, 'FORBIDDEN', 'No tienes permiso.'),
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.message).toBe('No tienes permiso.');
  });

  it('el id va codificado en la ruta', async () => {
    const api = mockApi({
      'GET /api/users/a%2Fb': () => errorResponse(404, 'NOT_FOUND', 'No encontrado.'),
    });
    const { wrapper } = setup();

    const { result } = renderHook(() => useUser('a/b'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api.callsTo('GET /api/users/a%2Fb')).toHaveLength(1);
  });
});

describe('useCreateUser', () => {
  it('hace POST /api/users con la cabecera anti-CSRF, guarda el detalle e invalida el listado', async () => {
    const api = mockApi({ 'POST /api/users': () => jsonResponse(201, LUCIA) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(userKeys.list, []);
    const { result } = renderHook(() => useCreateUser(), { wrapper });
    const input = {
      email: LUCIA.email,
      name: LUCIA.name,
      role: LUCIA.role,
      departmentIds: [DEPARTMENTS[1]!.id],
      password: 'Segura2026!',
    };

    await act(() => result.current.mutateAsync(input));

    const [request] = api.callsTo('POST /api/users');
    expect(request?.init.headers).toMatchObject({
      'X-Requested-With': 'fetch',
      'Content-Type': 'application/json',
    });
    expect(request?.init.body).toBe(JSON.stringify(input));
    expect(queryClient.getQueryData(userKeys.detail(LUCIA.id))).toEqual(LUCIA);
    expect(isStale(queryClient, userKeys.list)).toBe(true);
  });
});

describe('useUpdateUser', () => {
  it('hace PATCH, actualiza el detalle y la fila del listado e invalida el listado', async () => {
    const renamed = { ...LUCIA, name: 'Lucía Gil Pérez' };
    const api = mockApi({ [`PATCH /api/users/${LUCIA.id}`]: () => jsonResponse(200, renamed) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(userKeys.list, [LUCIA]);
    queryClient.setQueryData(userKeys.detail(LUCIA.id), LUCIA);
    queryClient.setQueryData(authKeys.me, DEMO_ADMIN);
    const { result } = renderHook(() => useUpdateUser(LUCIA.id), { wrapper });

    await act(() => result.current.mutateAsync({ name: renamed.name }));

    expect(api.callsTo(`PATCH /api/users/${LUCIA.id}`)[0]?.init.body).toBe(
      JSON.stringify({ name: renamed.name }),
    );
    expect(queryClient.getQueryData(userKeys.detail(LUCIA.id))).toEqual(renamed);
    expect(queryClient.getQueryData(userKeys.list)).toEqual([renamed]);
    expect(isStale(queryClient, userKeys.list)).toBe(true);
    expect(isStale(queryClient, userKeys.detail(LUCIA.id))).toBe(false);
    // Otro usuario: `me` no cambia.
    expect(isStale(queryClient, authKeys.me)).toBe(false);
  });

  it('si el usuario editado es el actual, invalida también `me`', async () => {
    const renamed = { ...SELF_ADMIN, name: 'Elena Ruiz Soto' };
    mockApi({ [`PATCH /api/users/${SELF_ADMIN.id}`]: () => jsonResponse(200, renamed) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(authKeys.me, DEMO_ADMIN);
    const { result } = renderHook(() => useUpdateUser(SELF_ADMIN.id), { wrapper });

    await act(() => result.current.mutateAsync({ name: renamed.name }));

    expect(isStale(queryClient, authKeys.me)).toBe(true);
  });

  it('un 409 llega como ApiError y no toca la caché', async () => {
    mockApi({
      [`PATCH /api/users/${LUCIA.id}`]: () =>
        errorResponse(409, 'CONFLICT', 'Ya existe un usuario con ese email.'),
    });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(userKeys.detail(LUCIA.id), LUCIA);
    const { result } = renderHook(() => useUpdateUser(LUCIA.id), { wrapper });

    await act(() =>
      result.current.mutateAsync({ email: 'otro@incidapp.test' }).catch(() => undefined),
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.error?.message).toBe('Ya existe un usuario con ese email.');
    expect(queryClient.getQueryData(userKeys.detail(LUCIA.id))).toEqual(LUCIA);
  });
});

describe('useSetUserActive', () => {
  it.each([
    [false, 'deactivate'],
    [true, 'activate'],
  ] as const)('active=%s hace POST /api/users/:id/%s sin cuerpo', async (active, path) => {
    const reply = active ? LUCIA : deactivated(LUCIA);
    const route = `POST /api/users/${LUCIA.id}/${path}`;
    const api = mockApi({ [route]: () => jsonResponse(200, reply) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(userKeys.list, [LUCIA]);
    const { result } = renderHook(() => useSetUserActive(LUCIA.id), { wrapper });

    await act(() => result.current.mutateAsync(active));

    const [request] = api.callsTo(route);
    expect(request?.init.headers).toMatchObject({ 'X-Requested-With': 'fetch' });
    expect(request?.init.body).toBeUndefined();
    expect(queryClient.getQueryData(userKeys.detail(LUCIA.id))).toEqual(reply);
    expect(queryClient.getQueryData(userKeys.list)).toEqual([reply]);
    expect(isStale(queryClient, userKeys.list)).toBe(true);
  });
});

describe('useResetUserPassword', () => {
  it('hace POST /api/users/:id/password con la contraseña y acepta el 204', async () => {
    const route = `POST /api/users/${LUCIA.id}/password`;
    const api = mockApi({ [route]: () => new Response(null, { status: 204 }) });
    const { wrapper } = setup();
    const { result } = renderHook(() => useResetUserPassword(LUCIA.id), { wrapper });

    await act(() => result.current.mutateAsync('NuevaClave2026'));

    const [request] = api.callsTo(route);
    expect(request?.init.headers).toMatchObject({
      'X-Requested-With': 'fetch',
      'Content-Type': 'application/json',
    });
    expect(request?.init.body).toBe(JSON.stringify({ password: 'NuevaClave2026' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
