import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/client';
import { authKeys } from '../queries/auth';
import { createQueryClient } from './providers';

function retryPolicy() {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function')
    throw new Error('La política de reintentos debe ser una función');
  return retry;
}

describe('createQueryClient', () => {
  it.each([400, 401, 403, 404, 409])('no reintenta un error %i de la API', (status) => {
    const error = new ApiError(status, 'NOT_FOUND', 'No encontrado.');
    expect(retryPolicy()(0, error)).toBe(false);
  });

  it('reintenta como mucho dos veces los errores 5xx y los de red', () => {
    const retry = retryPolicy();
    const serverError = new ApiError(503, 'INTERNAL', 'Error.');
    const networkError = new TypeError('Failed to fetch');

    expect(retry(0, serverError)).toBe(true);
    expect(retry(1, networkError)).toBe(true);
    expect(retry(2, serverError)).toBe(false);
  });
});

describe('createQueryClient · 401 durante el uso (CA-01.16)', () => {
  const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Necesitas iniciar sesión.');

  function setup() {
    const onSessionExpired = vi.fn();
    const queryClient = createQueryClient({ onSessionExpired });
    queryClient.setQueryData(authKeys.me, { name: 'Elena Ruiz' });
    queryClient.setQueryData(['incidents'], ['dato de la sesión']);
    return { queryClient, onSessionExpired };
  }

  it('un 401 de una query vacía la caché, deja `me` a null y avisa', async () => {
    const { queryClient, onSessionExpired } = setup();

    await queryClient
      .fetchQuery({ queryKey: ['other'], queryFn: () => Promise.reject(unauthorized()) })
      .catch(() => undefined);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['incidents'])).toBeUndefined();
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
  });

  it('con la sesión ya vaciada, otro 401 no vuelve a vaciar la caché ni a avisar (sin bucle)', async () => {
    const { queryClient, onSessionExpired } = setup();
    const fail401 = () =>
      queryClient
        .fetchQuery({ queryKey: ['other'], queryFn: () => Promise.reject(unauthorized()) })
        .catch(() => undefined);

    await fail401();
    // La página aún montada vuelve a pedir sus datos antes de que se complete la navegación.
    queryClient.setQueryData(['incidents'], ['dato recreado']);
    await fail401();

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['incidents'])).toEqual(['dato recreado']);
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
  });

  it('tras volver a iniciar sesión, un nuevo 401 se trata otra vez', async () => {
    const { queryClient, onSessionExpired } = setup();
    const fail401 = () =>
      queryClient
        .fetchQuery({ queryKey: ['other'], queryFn: () => Promise.reject(unauthorized()) })
        .catch(() => undefined);

    await fail401();
    queryClient.setQueryData(authKeys.me, { name: 'Elena Ruiz' }); // login correcto
    await fail401();

    expect(onSessionExpired).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(authKeys.me)).toBeNull();
  });

  it('un 401 de una mutación también', async () => {
    const { queryClient, onSessionExpired } = setup();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(unauthorized()),
    });

    await mutation.execute(undefined).catch(() => undefined);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['incidents'])).toBeUndefined();
  });

  it('el 401 del login (credenciales incorrectas) no es una sesión caducada', async () => {
    const { queryClient, onSessionExpired } = setup();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: authKeys.login,
      mutationFn: () => Promise.reject(unauthorized()),
    });

    await mutation.execute(undefined).catch(() => undefined);

    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['incidents'])).toEqual(['dato de la sesión']);
  });

  it.each([
    ['un 403', new ApiError(403, 'FORBIDDEN', 'No permitido.')],
    ['un 500', new ApiError(500, 'INTERNAL', 'Error.')],
    ['un error de red', new TypeError('Failed to fetch')],
  ])('%s no cierra la sesión', async (_name, error) => {
    const { queryClient, onSessionExpired } = setup();

    await queryClient
      .fetchQuery({ queryKey: ['other'], queryFn: () => Promise.reject(error), retry: false })
      .catch(() => undefined);

    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['incidents'])).toEqual(['dato de la sesión']);
  });
});
