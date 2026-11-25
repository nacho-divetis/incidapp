// Composition root: crea la conexión a la base de datos según la configuración y monta los casos de uso.
import { makeLogin } from '../application/auth/login';
import { makeLogout } from '../application/auth/logout';
import { makeResolveSession } from '../application/auth/resolve-session';
import { makeListDepartments } from '../application/departments/list-departments';
import { makeGetHealth, type GetHealth } from '../application/health/get-health';
import { makeAssignIncident } from '../application/incidents/assign-incident';
import { makeChangeIncidentStatus } from '../application/incidents/change-incident-status';
import { makeCreateIncident } from '../application/incidents/create-incident';
import { makeGetIncident } from '../application/incidents/get-incident';
import { makeListAssignees } from '../application/incidents/list-assignees';
import { makeListIncidentEvents } from '../application/incidents/list-incident-events';
import { makeListIncidentTypes } from '../application/incidents/list-incident-types';
import { makeListIncidents } from '../application/incidents/list-incidents';
import { makeUpdateIncident } from '../application/incidents/update-incident';
import { makeCreateUser } from '../application/users/create-user';
import { makeGetUser } from '../application/users/get-user';
import { makeListUsers } from '../application/users/list-users';
import { makeResetUserPassword } from '../application/users/reset-user-password';
import { makeSetUserActive } from '../application/users/set-user-active';
import { makeUpdateUser } from '../application/users/update-user';
import type { AppDeps, AuthDeps } from '../http/app';
import { createArgon2PasswordHasher } from '../infrastructure/auth/argon2-password-hasher';
import { createSessionTokens } from '../infrastructure/auth/session-tokens';
import { systemClock } from '../infrastructure/clock/system-clock';
import { createDatabase, type DatabaseHandle } from '../infrastructure/db/client';
import { createDatabaseHealth } from '../infrastructure/db/database-health';
import { createDrizzleAuditLogWriter } from '../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleDepartmentRepository } from '../infrastructure/db/repositories/department-repository';
import { createDrizzleIncidentEventReader } from '../infrastructure/db/repositories/incident-event-reader';
import { createDrizzleIncidentRepository } from '../infrastructure/db/repositories/incident-repository';
import { createDrizzleIncidentTypeRepository } from '../infrastructure/db/repositories/incident-type-repository';
import { createDrizzleSessionRepository } from '../infrastructure/db/repositories/session-repository';
import { createDrizzleUserAdminRepository } from '../infrastructure/db/repositories/user-admin-repository';
import { createDrizzleUserRepository } from '../infrastructure/db/repositories/user-repository';
import { createDrizzleUnitOfWork } from '../infrastructure/db/unit-of-work';
import type { Config } from './config';

export interface Container {
  database: DatabaseHandle;
  getHealth: GetHealth;
  /** Casos de uso de la autenticación y límite de intentos del login. */
  auth: AuthDeps;
  /** Casos de uso de la gestión de usuarios. */
  users: AppDeps['users'];
  /** Catálogo de departamentos. */
  departments: AppDeps['departments'];
  /** Catálogo de tipos de incidencia. */
  incidentTypes: AppDeps['incidentTypes'];
  /** Casos de uso de las incidencias. */
  incidents: AppDeps['incidents'];
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

  const userAdminDeps = {
    users: createDrizzleUserAdminRepository(database.db),
    departments: createDrizzleDepartmentRepository(database.db),
    unitOfWork: createDrizzleUnitOfWork(database.db),
    passwordHasher: authDeps.passwordHasher,
    clock: systemClock,
  };

  const incidentDeps = {
    incidents: createDrizzleIncidentRepository(database.db),
    incidentTypes: createDrizzleIncidentTypeRepository(database.db),
    incidentEvents: createDrizzleIncidentEventReader(database.db),
    users: userAdminDeps.users,
    unitOfWork: userAdminDeps.unitOfWork,
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
    users: {
      listUsers: makeListUsers(userAdminDeps),
      getUser: makeGetUser(userAdminDeps),
      createUser: makeCreateUser(userAdminDeps),
      updateUser: makeUpdateUser(userAdminDeps),
      setUserActive: makeSetUserActive(userAdminDeps),
      resetUserPassword: makeResetUserPassword(userAdminDeps),
    },
    departments: { listDepartments: makeListDepartments(userAdminDeps) },
    incidentTypes: { listIncidentTypes: makeListIncidentTypes(incidentDeps) },
    incidents: {
      listIncidents: makeListIncidents(incidentDeps),
      getIncident: makeGetIncident(incidentDeps),
      createIncident: makeCreateIncident(incidentDeps),
      updateIncident: makeUpdateIncident(incidentDeps),
      listAssignees: makeListAssignees(incidentDeps),
      assignIncident: makeAssignIncident(incidentDeps),
      changeIncidentStatus: makeChangeIncidentStatus(incidentDeps),
      listIncidentEvents: makeListIncidentEvents(incidentDeps),
    },
    close: () => database.close(),
  };
}
