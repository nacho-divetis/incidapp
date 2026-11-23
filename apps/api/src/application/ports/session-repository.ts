import type { Session } from '../../domain/auth/session';

/** Puerto de persistencia de las sesiones (tabla `sessions`). */
export interface SessionRepository {
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  /** Borra la sesión si existe; no falla si no existe. */
  delete(id: string): Promise<void>;
  /** Borra todas las sesiones del usuario (p. ej., al detectar que está desactivado). */
  deleteAllForUser(userId: string): Promise<void>;
  /** Borra las sesiones del usuario que ya han caducado en `now`. */
  deleteExpiredForUser(userId: string, now: Date): Promise<void>;
}
