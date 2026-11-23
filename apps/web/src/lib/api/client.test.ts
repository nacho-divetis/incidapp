import { HealthResponse } from '@incidapp/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiGet, apiSend } from './client';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Opciones con las que se llamó a `fetch` en la llamada `index`. */
function fetchCall(index = 0): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch no se llamó ${index + 1} veces`);
  return { url: String(call[0]), init: call[1] ?? {} };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('apiGet', () => {
  it('pide la ruta bajo `/api` y devuelve el cuerpo validado con el esquema', async () => {
    const body = { status: 'ok', db: 'ok', version: '0.1.0' };
    fetchMock.mockResolvedValue(jsonResponse(200, body));

    await expect(apiGet('/health', HealthResponse)).resolves.toEqual(body);

    const { url, init } = fetchCall();
    expect(url).toBe('/api/health');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.headers).not.toHaveProperty('X-Requested-With');
  });

  it('convierte un `ErrorResponse` en un `ApiError` con estado, código, mensaje y detalles', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION',
          message: 'Los datos no son válidos.',
          details: [{ path: 'title', message: 'El título es obligatorio.' }],
        },
      }),
    );

    const error = await apiGet('/health', HealthResponse).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION',
      message: 'Los datos no son válidos.',
      details: [{ path: 'title', message: 'El título es obligatorio.' }],
    });
  });

  it.each([
    [404, 'NOT_FOUND'],
    [403, 'FORBIDDEN'],
    [429, 'TOO_MANY_REQUESTS'],
    [502, 'INTERNAL'],
  ] as const)(
    'si el error %i no trae un `ErrorResponse`, lanza un `ApiError` %s con un mensaje genérico',
    async (status, code) => {
      fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status }));

      const error = await apiGet('/health', HealthResponse).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status,
        code,
        message: 'Se ha producido un error inesperado.',
      });
    },
  );

  it('lanza un `ApiError` si la respuesta correcta no cumple el esquema del contrato', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'degraded' }));

    const error = await apiGet('/health', HealthResponse).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 200,
      code: 'INTERNAL',
      message: 'La respuesta del servidor no tiene el formato esperado.',
    });
  });

  it('propaga el error de red si la API no responde', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiGet('/health', HealthResponse)).rejects.toThrow(TypeError);
  });
});

describe('apiSend', () => {
  it('envía el cuerpo en JSON con `credentials: include` y `X-Requested-With: fetch`', async () => {
    const created = z.object({ id: z.string() });
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'abc' }));

    await expect(apiSend('POST', '/incidents', created, { title: 'Prueba' })).resolves.toEqual({
      id: 'abc',
    });

    const { url, init } = fetchCall();
    expect(url).toBe('/api/incidents');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({
      'X-Requested-With': 'fetch',
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe(JSON.stringify({ title: 'Prueba' }));
  });

  it('acepta respuestas sin cuerpo (204) y no envía `Content-Type` si no hay cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiSend('DELETE', '/incidents/abc', z.undefined())).resolves.toBeUndefined();

    const { init } = fetchCall();
    expect(init.headers).toMatchObject({ 'X-Requested-With': 'fetch' });
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.body).toBeUndefined();
  });

  it('convierte un `ErrorResponse` en un `ApiError`', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: { code: 'CONFLICT', message: 'La incidencia ha cambiado.' } }),
    );

    await expect(apiSend('PATCH', '/incidents/abc', z.undefined(), {})).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'La incidencia ha cambiado.',
    });
  });
});
