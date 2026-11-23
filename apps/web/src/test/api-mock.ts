// `fetch` simulado para los tests de páginas y de `app/`: responde según "MÉTODO /ruta" y guarda las
// peticiones recibidas. Una ruta sin respuesta definida hace fallar el test con un mensaje claro.
import type { CurrentUser } from '@incidapp/shared';
import { vi } from 'vitest';

export type MockReply = Response | (() => Response | Promise<Response>);

export interface RecordedRequest {
  method: string;
  path: string;
  init: RequestInit;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

export const unauthorized = () => errorResponse(401, 'UNAUTHORIZED', 'Necesitas iniciar sesión.');

/** Respuesta que no llega nunca (para ver estados de carga). */
export const never = () => new Promise<Response>(() => {});

export const HEALTH_OK = { status: 'ok', db: 'ok', version: '0.1.0' } as const;

export const DEMO_ADMIN: CurrentUser = {
  id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  email: 'admin@incidapp.test',
  name: 'Elena Ruiz',
  role: 'ADMIN',
  departments: [
    { id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', code: 'ADM', name: 'Administración' },
  ],
};

/**
 * Sustituye `fetch` por un simulador. `routes` asocia "MÉTODO /api/ruta" a una respuesta o a una
 * función que la crea (para respuestas que cambian entre llamadas, usa la función).
 */
export function mockApi(initialRoutes: Record<string, MockReply> = {}) {
  const routes = new Map<string, MockReply>(Object.entries(initialRoutes));
  const requests: RecordedRequest[] = [];

  const fetchMock = vi.fn<typeof fetch>(async (input, init = {}) => {
    const path = String(input);
    const method = init.method ?? 'GET';
    requests.push({ method, path, init });
    const reply = routes.get(`${method} ${path}`);
    if (!reply) throw new Error(`Petición no simulada en el test: ${method} ${path}`);
    // Un `Response` solo se puede leer una vez: se clona en cada uso.
    return typeof reply === 'function' ? reply() : reply.clone();
  });
  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    requests,
    /** Define o cambia la respuesta de una ruta. */
    on(route: string, reply: MockReply) {
      routes.set(route, reply);
    },
    /** Peticiones recibidas a "MÉTODO /api/ruta". */
    callsTo(route: string) {
      return requests.filter((request) => `${request.method} ${request.path}` === route);
    },
  };
}
