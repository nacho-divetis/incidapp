import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api/client';
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
