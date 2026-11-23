import type { CurrentUser } from '@incidapp/shared';
import { isSessionExpired } from '../../domain/auth/session';
import { globalActionsFor } from '../authorization/authorization-policy';
import { UnauthorizedError } from '../errors';
import type { Clock } from '../ports/clock';
import type { SessionRepository } from '../ports/session-repository';
import type { SessionTokens } from '../ports/session-tokens';
import type { UserRepository } from '../ports/user-repository';

export interface ResolveSessionDeps {
  users: UserRepository;
  sessions: SessionRepository;
  sessionTokens: SessionTokens;
  clock: Clock;
}

export interface ResolveSessionQuery {
  /** *Token* de la cookie, si la petición la trae. */
  token?: string | undefined;
}

export type ResolveSession = (query: ResolveSessionQuery) => Promise<CurrentUser>;

/**
 * Devuelve el usuario de una sesión válida (CA-01.5). Sin sesión → `UnauthorizedError`. Una sesión
 * caducada se borra; si el usuario está desactivado o ya no existe, se borran todas sus sesiones
 * (CA-01.6, `docs/permisos.md`: "usuario desactivado"). El usuario se lee de la BD en cada petición,
 * así que un cambio de rol cambia ya sus `allowedActions` en la siguiente (CA-02.4).
 */
export const makeResolveSession =
  ({ users, sessions, sessionTokens, clock }: ResolveSessionDeps): ResolveSession =>
  async ({ token }) => {
    if (!token) throw new UnauthorizedError();

    const session = await sessions.findById(sessionTokens.idFor(token));
    if (!session) throw new UnauthorizedError();

    if (isSessionExpired(session.expiresAt, clock.now())) {
      await sessions.delete(session.id);
      throw new UnauthorizedError();
    }

    const record = await users.findCurrentUser(session.userId);
    if (!record?.active) {
      await sessions.deleteAllForUser(session.userId);
      throw new UnauthorizedError();
    }

    return { ...record.user, allowedActions: globalActionsFor(record.user) };
  };
