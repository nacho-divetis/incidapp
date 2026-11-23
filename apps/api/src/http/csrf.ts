// Protección anti-CSRF (RNF-07): toda petición a `/api` que modifica datos debe llevar la cabecera
// `X-Requested-With`. Un formulario de otro sitio no puede añadirla, y una petición `fetch` de otro
// origen que la añada necesita un *preflight* CORS que la API no autoriza.
import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from '../application/errors';
import { isApiPath } from './api-path';

export const CSRF_HEADER_MISSING_MESSAGE =
  'Petición no permitida: falta la cabecera X-Requested-With.';

/** Métodos que no modifican datos y no necesitan la cabecera. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * *Hook* `onRequest` global. Se registra antes que las rutas, así que corre antes que el límite de
 * intentos (que es de ruta) y que la validación del cuerpo (CA-01.10). La ruta se decide por el
 * patrón de la ruta encontrada (ya decodificado) y, si no hay ninguna, por la URL recibida.
 */
export async function csrfGuard(request: FastifyRequest): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return;

  const pathname = request.routeOptions.url ?? request.url.split('?')[0] ?? '/';
  if (!isApiPath(pathname)) return;

  const header = request.headers['x-requested-with'];
  const value = Array.isArray(header) ? header.join('') : header;
  if (!value?.trim()) throw new ForbiddenError(CSRF_HEADER_MISSING_MESSAGE);
}
