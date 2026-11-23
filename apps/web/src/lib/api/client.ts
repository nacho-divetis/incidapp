// Cliente HTTP de la web. Todas las peticiones a la API pasan por aquí: validan la respuesta con el
// esquema de `@incidapp/shared` y convierten los errores de la API en `ApiError`.
import { ErrorResponse, type ErrorCode, type ErrorDetail } from '@incidapp/shared';
import type { z } from 'zod';

/** Prefijo de la API. En desarrollo lo atiende el proxy de Vite; en producción, la propia API. */
export const API_BASE_PATH = '/api';

/** Métodos que modifican datos: llevan la cabecera anti-CSRF `X-Requested-With`. */
export type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const GENERIC_ERROR_MESSAGE = 'Se ha producido un error inesperado.';
const INVALID_RESPONSE_MESSAGE = 'La respuesta del servidor no tiene el formato esperado.';

/** Error de una petición a la API, con el código HTTP y el código y mensaje del contrato. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[] | undefined;

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Código del contrato que corresponde a un estado HTTP cuando el cuerpo no es un `ErrorResponse`. */
function codeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'INTERNAL';
  }
}

/** Lee el cuerpo como JSON; devuelve `undefined` si está vacío o no es JSON. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function request<T>(
  method: 'GET' | WriteMethod,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Requested-With'] = 'fetch';
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const parsedError = ErrorResponse.safeParse(payload);
    if (parsedError.success) {
      const { code, message, details } = parsedError.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, codeFromStatus(response.status), GENERIC_ERROR_MESSAGE);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(response.status, 'INTERNAL', INVALID_RESPONSE_MESSAGE);
  }
  return parsed.data;
}

/** `GET` a la API (`path` sin el prefijo `/api`), validado con `schema`. */
export function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return request('GET', path, schema);
}

/** Petición que modifica datos (`POST`, `PUT`, `PATCH` o `DELETE`), con el cuerpo en JSON. */
export function apiSend<T>(
  method: WriteMethod,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  return request(method, path, schema, body);
}
