// Composition root: crea la conexión a la base de datos según la configuración y monta los casos de uso.
import { makeLogin } from '../application/auth/login';
import { makeLogout } from '../application/auth/logout';
import { makeResolveSession } from '../application/auth/resolve-session';
import { makeGetHealth, type GetHealth } from '../application/health/get-health';
import type { AuthDeps } from '../http/app';
import { createArgon2PasswordHasher } from '../infrastructure/auth/argon2-password-hasher';
import { createSessionTokens } from '../infrastructure/auth/session-tokens';
import { systemClock } from '../infrastructure/clock/system-clock';
import { createDatabase, type DatabaseHandle } from '../infrastructure/db/client';
import { createDatabaseHealth } from '../infrastructure/db/database-health';
import { createDrizzleAuditLogWriter } from '../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleSessionRepository } from '../infrastructure/db/repositories/session-repository';
import { createDrizzleUserRepository } from '../infrastructure/db/repositories/user-repository';
import type { Config } from './config';

export interface Container {
  database: DatabaseHandle;
  getHealth: GetHealth;
  /** Casos de uso de la autenticación y límite de intentos del login. */
  auth: AuthDeps;
  /** Cierra la conexión a la base de datos. */
  close(): Promise<void>;
}

export async function createContainer(config: Config): Promise<Container> {
  // PGlite sin DATABASE_URL; node-postgres con SSL con ella (la elección está en `config.database`).
  const database = await createDatabase(config.database);

  const authDeps = {
    users: createDrizzleUserRepository(database.db),
    sessions: createDrizzleSessionRepository(database.db),
    auditLog: createDrizzleAuditLogWriter(database.db),
    passwordHasher: createArgon2PasswordHasher(),
    sessionTokens: createSessionTokens(),
    clock: systemClock,
  };

  return {
    database,
    getHealth: makeGetHealth({
      databaseHealth: createDatabaseHealth(database.db),
      version: config.version,
    }),
    auth: {
      login: makeLogin(authDeps),
      logout: makeLogout(authDeps),
      resolveSession: makeResolveSession(authDeps),
      loginRateLimit: config.loginRateLimit,
    },
    close: () => database.close(),
  };
}
