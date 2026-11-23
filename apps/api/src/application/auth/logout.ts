import type { SessionRepository } from '../ports/session-repository';
import type { SessionTokens } from '../ports/session-tokens';

export interface LogoutDeps {
  sessions: SessionRepository;
  sessionTokens: SessionTokens;
}

export interface LogoutCommand {
  /** *Token* de la cookie, si la petición la trae. */
  token?: string | undefined;
}

export type Logout = (command: LogoutCommand) => Promise<void>;

/** Cierra la sesión borrándola de la BD. Idempotente: nunca falla por no haber sesión (CA-01.7). */
export const makeLogout =
  ({ sessions, sessionTokens }: LogoutDeps): Logout =>
  async ({ token }) => {
    if (!token) return;
    await sessions.delete(sessionTokens.idFor(token));
  };
