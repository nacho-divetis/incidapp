import { EMAIL_MAX_LENGTH, type CurrentUser } from '@incidapp/shared';
import { sessionExpiresAt } from '../../domain/auth/session';
import { normalizeEmail, type UserAccount } from '../../domain/auth/user';
import { UnauthorizedError } from '../errors';
import type { AuditLogWriter } from '../ports/audit-log-writer';
import type { Clock } from '../ports/clock';
import type { PasswordHasher } from '../ports/password-hasher';
import type { SessionRepository } from '../ports/session-repository';
import type { SessionTokens } from '../ports/session-tokens';
import type { UserRepository } from '../ports/user-repository';

/** Mensaje único para cualquier fallo de credenciales: no revela si el email existe (CA-01.2). */
export const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos.';

/** Motivo del fallo. Solo queda en la auditoría; nunca se devuelve al cliente. */
export type LoginFailureReason = 'UNKNOWN_EMAIL' | 'BAD_PASSWORD' | 'INACTIVE';

/**
 * Contraseña con la que se calcula el *hash* ficticio. No protege nada: solo sirve para que un
 * email inexistente cueste lo mismo que uno existente.
 */
const DUMMY_PASSWORD = 'incidapp-verificacion-ficticia';

export interface LoginDeps {
  users: UserRepository;
  sessions: SessionRepository;
  auditLog: AuditLogWriter;
  passwordHasher: PasswordHasher;
  sessionTokens: SessionTokens;
  clock: Clock;
}

export interface LoginCommand {
  /** Email tal como llega (validado con `LoginInput`); se normaliza otra vez por seguridad. */
  email: string;
  password: string;
  /** IP del cliente para la auditoría, si se conoce. */
  ip: string | null;
  /** *Token* de la sesión que ya traía la petición: se borra al iniciar sesión (rotación). */
  currentToken?: string | undefined;
}

export interface LoginResult {
  user: CurrentUser;
  /** *Token* en claro para la cookie. En la BD solo se guarda `sessionTokens.idFor(token)`. */
  token: string;
  expiresAt: Date;
}

export type Login = (command: LoginCommand) => Promise<LoginResult>;

/**
 * Inicia sesión: verifica las credenciales, rota la sesión, borra las caducadas del usuario, crea la
 * nueva y audita el resultado (CA-01.1, CA-01.2, CA-01.4, CA-01.9).
 */
export const makeLogin = (deps: LoginDeps): Login => {
  const { users, sessions, auditLog, passwordHasher, sessionTokens, clock } = deps;

  // El hash ficticio se calcula al construir el caso de uso, con los mismos parámetros que los
  // reales: así ni el primer login con un email inexistente cuesta más que los demás.
  const computeDummyHash = (): Promise<string> => {
    const pending = passwordHasher.hash(DUMMY_PASSWORD);
    // Evita un rechazo no gestionado si falla antes de que nadie lo espere; se reintenta al usarlo.
    pending.catch(() => {});
    return pending;
  };
  let dummyHash = computeDummyHash();
  const getDummyHash = async (): Promise<string> => {
    try {
      return await dummyHash;
    } catch {
      dummyHash = computeDummyHash();
      return dummyHash;
    }
  };

  const fail = async (
    email: string,
    ip: string | null,
    account: UserAccount | null,
    reason: LoginFailureReason,
  ): Promise<never> => {
    await auditLog.record({
      actorId: account?.id ?? null,
      action: 'LOGIN_FAILED',
      entity: 'user',
      entityId: account?.id ?? null,
      // Recortado por defensa en profundidad: `audit_log` es solo de inserción y no se puede purgar.
      after: { email: email.slice(0, EMAIL_MAX_LENGTH), reason },
      ip,
      createdAt: clock.now(),
    });
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  };

  return async ({ email: rawEmail, password, ip, currentToken }) => {
    const email = normalizeEmail(rawEmail);
    const account = await users.findAccountByEmail(email);

    if (!account) {
      await passwordHasher.verify(await getDummyHash(), password);
      return fail(email, ip, null, 'UNKNOWN_EMAIL');
    }
    // La contraseña se verifica siempre, también si el usuario está desactivado: mismo coste.
    if (!(await passwordHasher.verify(account.passwordHash, password))) {
      return fail(email, ip, account, 'BAD_PASSWORD');
    }
    if (!account.active) return fail(email, ip, account, 'INACTIVE');

    const record = await users.findCurrentUser(account.id);
    if (!record?.active) return fail(email, ip, account, 'INACTIVE');

    const now = clock.now();
    if (currentToken) await sessions.delete(sessionTokens.idFor(currentToken));
    await sessions.deleteExpiredForUser(account.id, now);

    const token = sessionTokens.generate();
    const expiresAt = sessionExpiresAt(now);
    await sessions.create({
      id: sessionTokens.idFor(token),
      userId: account.id,
      expiresAt,
      createdAt: now,
    });
    await auditLog.record({
      actorId: account.id,
      action: 'LOGIN_SUCCEEDED',
      entity: 'user',
      entityId: account.id,
      ip,
      createdAt: now,
    });

    return { user: record.user, token, expiresAt };
  };
};
