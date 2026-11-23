// `requireSession`: *preHandler* reutilizable de las rutas protegidas (F01 y siguientes).
import type { CurrentUser } from '@incidapp/shared';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { ResolveSession } from '../../application/auth/resolve-session';
import { UnauthorizedError } from '../../application/errors';
import { readSessionToken } from './session-cookie';

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuario de la sesión. Solo lo rellena `requireSession`; en el resto de rutas es `null`. */
    currentUser: CurrentUser | null;
  }
}

/** Declara `request.currentUser` en la instancia raíz. Se llama una vez, antes de las rutas. */
export function decorateCurrentUser(app: FastifyInstance): void {
  app.decorateRequest('currentUser', null);
}

export interface RequireSessionDeps {
  resolveSession: ResolveSession;
}

/**
 * Resuelve la sesión de la cookie y deja el usuario en `request.currentUser`. Sin sesión válida,
 * `resolveSession` lanza `UnauthorizedError` y la respuesta es 401 (CA-01.5, CA-01.6).
 */
export const makeRequireSession =
  ({ resolveSession }: RequireSessionDeps): preHandlerAsyncHookHandler =>
  async (request) => {
    request.currentUser = await resolveSession({ token: readSessionToken(request) });
  };

/** Usuario de una ruta protegida con `requireSession`. Si falta, la ruta no lo usa: 401. */
export function currentUserOf(request: FastifyRequest): CurrentUser {
  if (!request.currentUser) throw new UnauthorizedError();
  return request.currentUser;
}
