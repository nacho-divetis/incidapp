// Reglas de la sesión: duración fija desde el login, sin renovación al usarla (spec F01, duda 1).

/** Duración de una sesión: 7 días desde el inicio de sesión. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sesión guardada. `id` es el SHA-256 del *token* de la cookie (nunca el *token* en claro), de modo
 * que una filtración de la tabla no permite suplantar a nadie (ADR-003).
 */
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Instante en que caduca una sesión creada en `now`. */
export function sessionExpiresAt(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

/** Una sesión está caducada desde el instante `expiresAt` (incluido). */
export function isSessionExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}
