import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/client';
import { DEMO_ADMIN, errorResponse, jsonResponse, mockApi, unauthorized } from '../test/api-mock';
import { authKeys, useCurrentUser, useLogin, useLogout } from './auth';

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useCurrentUser', () => {
  it('devuelve el usuario de GET /api/auth/me', async () => {
    mockApi({ 'GET /api/auth/me': () => jsonResponse(200, DEMO_ADMIN) });
    const { wrapper } = setup();

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(DEMO_ADMIN);
  });

  it('un 401 no es un error: devuelve null (sin sesión)', async () => {
    mockApi({ 'GET /api/auth/me': unauthorized });
    const { wrapper } = setup();

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('otros errores sí son errores', async () => {
    mockApi({ 'GET /api/auth/me': () => errorResponse(500, 'INTERNAL', 'Error.') });
    const { wrapper } = setup();

    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe('useLogin', () => {
  it('envía las credenciales con la cabecera anti-CSRF y guarda el usuario en la caché de `me`', async () => {
    const api = mockApi({ 'POST /api/auth/login': () => jsonResponse(200, DEMO_ADMIN) });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current.mutateAsync({ email: DEMO_ADMIN.email, password: 'Demo2026!' }));

    const [request] = api.callsTo('POST /api/auth/login');
    expect(request?.init.headers).toMatchObject({
      'X-Requested-With': 'fetch',
      'Content-Type': 'application/json',
    });
    expect(request?.init.credentials).toBe('include');
    expect(request?.init.body).toBe(
      JSON.stringify({ email: DEMO_ADMIN.email, password: 'Demo2026!' }),
    );
    expect(queryClient.getQueryData(authKeys.me)).toEqual(DEMO_ADMIN);
  });

  it('con credenciales incorrectas, el error lleva el mensaje de la API y no toca `me`', async () => {
    mockApi({
      'POST /api/auth/login': () =>
        errorResponse(401, 'UNAUTHORIZED', 'Email o contraseña incorrectos.'),
    });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(authKeys.me, null);
    const { result } = renderHook(() => useLogin(), { wrapper });

    act(() => result.current.mutate({ email: DEMO_ADMIN.email, password: 'mala' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Email o contraseña incorrectos.');
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
  });
});

describe('useLogout', () => {
  it('hace POST /api/auth/logout sin cuerpo ni Content-Type, vacía la caché y deja `me` a null', async () => {
    const api = mockApi({ 'POST /api/auth/logout': () => new Response(null, { status: 204 }) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(authKeys.me, DEMO_ADMIN);
    queryClient.setQueryData(['incidents'], ['dato de la sesión']);
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(() => result.current.mutateAsync());

    const [request] = api.callsTo('POST /api/auth/logout');
    expect(request?.init.headers).toMatchObject({ 'X-Requested-With': 'fetch' });
    expect(request?.init.headers).not.toHaveProperty('Content-Type');
    expect(request?.init.body).toBeUndefined();
    expect(queryClient.getQueryData(['incidents'])).toBeUndefined();
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
  });

  it('si falla, no toca la caché', async () => {
    mockApi({ 'POST /api/auth/logout': () => errorResponse(500, 'INTERNAL', 'Error.') });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(authKeys.me, DEMO_ADMIN);
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(queryClient.getQueryData(authKeys.me)).toEqual(DEMO_ADMIN);
  });
});
