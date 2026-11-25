// Matriz de autorización de la API (CA-02.15): endpoint × {sin sesión, ADMIN, DIRECTOR, MANAGER, USER}.
// Fuente de verdad: `docs/permisos.md`. F03 y F04 añaden filas a `ROWS` (o tablas análogas) con
// incidencias visibles y no visibles. Cada caso usa un usuario destino nuevo para no depender del orden.
import type { Role } from '@incidapp/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeLogin } from '../application/auth/login';
import { makeLogout } from '../application/auth/logout';
import { makeResolveSession } from '../application/auth/resolve-session';
import { FixedClock } from '../application/auth/test-fakes';
import { makeListDepartments } from '../application/departments/list-departments';
import { makeCreateUser } from '../application/users/create-user';
import { makeGetUser } from '../application/users/get-user';
import { makeListUsers } from '../application/users/list-users';
import { makeResetUserPassword } from '../application/users/reset-user-password';
import { makeSetUserActive } from '../application/users/set-user-active';
import { makeUpdateUser } from '../application/users/update-user';
import { createArgon2PasswordHasher } from '../infrastructure/auth/argon2-password-hasher';
import { createSessionTokens } from '../infrastructure/auth/session-tokens';
import type { DatabaseHandle } from '../infrastructure/db/client';
import { createDrizzleAuditLogWriter } from '../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleDepartmentRepository } from '../infrastructure/db/repositories/department-repository';
import { createDrizzleSessionRepository } from '../infrastructure/db/repositories/session-repository';
import { createDrizzleUserAdminRepository } from '../infrastructure/db/repositories/user-admin-repository';
import { createDrizzleUserRepository } from '../infrastructure/db/repositories/user-repository';
import { seedDatabase } from '../infrastructure/db/seed';
import { createTestDatabase } from '../infrastructure/db/test-database';
import { createDrizzleUnitOfWork } from '../infrastructure/db/unit-of-work';
import { buildApp } from './app';
import { createAuthzClient, unusedIncidents, type AuthzClient } from './test-support';

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff';
const ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'] as const satisfies readonly Role[];
const WHO = ['none', ...ROLES] as const;
const PASSWORD = 'Clave-Prueba-2026';

/** [sin sesión, ADMIN, DIRECTOR, MANAGER, USER] */
type Expected = readonly [number, number, number, number, number];

interface Ctx {
  targetId: string;
  newEmail: string;
}
interface Row {
  name: string;
  method: 'GET' | 'POST' | 'PATCH';
  path: (ctx: Ctx) => string;
  body?: (ctx: Ctx) => unknown;
  expected: Expected;
}

/** Solo el Admin (permisos.md → Gestionar usuarios): 401 sin sesión, `admin` para el Admin, 403 al resto. */
const adminOnly = (admin: number): Expected => [401, admin, 403, 403, 403];

const validCreate = (c: Ctx) => ({
  email: c.newEmail,
  name: 'Persona Prueba',
  role: 'USER',
  departmentIds: [departmentId],
  password: PASSWORD,
});

const ROWS: Row[] = [
  {
    name: 'CA-02.5: listar usuarios',
    method: 'GET',
    path: () => '/api/users',
    expected: adminOnly(200),
  },
  {
    name: 'CA-02.5: ver un usuario',
    method: 'GET',
    path: (c) => `/api/users/${c.targetId}`,
    expected: adminOnly(200),
  },
  {
    name: 'CA-02.7: crear usuario',
    method: 'POST',
    path: () => '/api/users',
    body: validCreate,
    expected: adminOnly(201),
  },
  {
    name: 'CA-02.8: editar usuario',
    method: 'PATCH',
    path: (c) => `/api/users/${c.targetId}`,
    body: () => ({ name: 'Nombre Nuevo' }),
    expected: adminOnly(200),
  },
  {
    name: 'CA-02.9: desactivar usuario',
    method: 'POST',
    path: (c) => `/api/users/${c.targetId}/deactivate`,
    expected: adminOnly(200),
  },
  {
    name: 'CA-02.9: reactivar usuario',
    method: 'POST',
    path: (c) => `/api/users/${c.targetId}/activate`,
    expected: adminOnly(200),
  },
  {
    name: 'CA-02.12: restablecer contraseña',
    method: 'POST',
    path: (c) => `/api/users/${c.targetId}/password`,
    body: () => ({ password: 'Otra-Clave-2026' }),
    expected: adminOnly(204),
  },
  // Id inexistente: el no-Admin recibe 403 (no 404); el Admin, 404.
  {
    name: 'CA-02.6: ver usuario inexistente',
    method: 'GET',
    path: () => `/api/users/${MISSING_ID}`,
    expected: adminOnly(404),
  },
  {
    name: 'CA-02.6: editar usuario inexistente',
    method: 'PATCH',
    path: () => `/api/users/${MISSING_ID}`,
    body: () => ({ name: 'Nombre Nuevo' }),
    expected: adminOnly(404),
  },
  {
    name: 'CA-02.6: desactivar usuario inexistente',
    method: 'POST',
    path: () => `/api/users/${MISSING_ID}/deactivate`,
    expected: adminOnly(404),
  },
  {
    name: 'CA-02.6: reactivar usuario inexistente',
    method: 'POST',
    path: () => `/api/users/${MISSING_ID}/activate`,
    expected: adminOnly(404),
  },
  {
    name: 'CA-02.6: restablecer contraseña de usuario inexistente',
    method: 'POST',
    path: () => `/api/users/${MISSING_ID}/password`,
    body: () => ({ password: 'Otra-Clave-2026' }),
    expected: adminOnly(404),
  },
  {
    name: 'CA-02.6: id que no es un UUID',
    method: 'GET',
    path: () => '/api/users/no-es-uuid',
    expected: adminOnly(404),
  },
  // Cuerpo inválido: el no-Admin recibe 403 antes que 400.
  {
    name: 'CA-02.5: cuerpo inválido al crear',
    method: 'POST',
    path: () => '/api/users',
    body: () => ({ email: 'no-es-email' }),
    expected: adminOnly(400),
  },
  {
    name: 'CA-02.5: cuerpo vacío al editar',
    method: 'PATCH',
    path: (c) => `/api/users/${c.targetId}`,
    body: () => ({}),
    expected: adminOnly(400),
  },
  // Catálogo: cualquier usuario con sesión.
  {
    name: 'CA-02.14: catálogo de departamentos',
    method: 'GET',
    path: () => '/api/departments',
    expected: [401, 200, 200, 200, 200],
  },
];

let api: AuthzClient;
let database: DatabaseHandle;
let closeApp: () => Promise<void>;
let departmentId = '';
let counter = 0;

beforeAll(async () => {
  const argon2 = createArgon2PasswordHasher();
  database = await createTestDatabase();
  await seedDatabase(database.db, { passwordHasher: argon2 });
  const clock = new FixedClock(new Date('2026-11-23T10:00:00.000Z'));
  const authDeps = {
    users: createDrizzleUserRepository(database.db),
    sessions: createDrizzleSessionRepository(database.db),
    auditLog: createDrizzleAuditLogWriter(database.db),
    passwordHasher: argon2,
    sessionTokens: createSessionTokens(),
    clock,
  };
  const adminDeps = {
    users: createDrizzleUserAdminRepository(database.db),
    departments: createDrizzleDepartmentRepository(database.db),
    unitOfWork: createDrizzleUnitOfWork(database.db),
    passwordHasher: argon2,
    clock,
  };
  const app = await buildApp({
    getHealth: async () => ({ status: 'ok', db: 'ok', version: '0.1.0' }),
    auth: {
      login: makeLogin(authDeps),
      logout: makeLogout(authDeps),
      resolveSession: makeResolveSession(authDeps),
      loginRateLimit: { max: 10_000, timeWindowMs: 60_000 },
    },
    users: {
      listUsers: makeListUsers(adminDeps),
      getUser: makeGetUser(adminDeps),
      createUser: makeCreateUser(adminDeps),
      updateUser: makeUpdateUser(adminDeps),
      setUserActive: makeSetUserActive(adminDeps),
      resetUserPassword: makeResetUserPassword(adminDeps),
    },
    departments: { listDepartments: makeListDepartments(adminDeps) },
    // Las filas de incidencias (CA-03.11) las añade T-03.05 con los casos de uso reales.
    ...unusedIncidents,
    enforceHttps: false,
    logger: false,
  });
  closeApp = () => app.close();
  api = await createAuthzClient(app);
  const catalog = await api.call('GET', '/api/departments', { token: api.tokens.ADMIN });
  departmentId = (catalog.json() as { id: string }[])[0]!.id;
}, 60_000);

afterAll(async () => {
  await closeApp();
  await database.close();
});

/** Usuario destino nuevo para cada caso: ningún test depende del estado que dejó otro. */
async function freshContext(): Promise<Ctx> {
  counter += 1;
  const created = await api.call('POST', '/api/users', {
    token: api.tokens.ADMIN,
    payload: {
      email: `destino.${counter}@incidapp.test`,
      name: 'Destino Prueba',
      role: 'USER',
      departmentIds: [departmentId],
      password: PASSWORD,
    },
  });
  expect(created.statusCode).toBe(201);
  return {
    targetId: (created.json() as { id: string }).id,
    newEmail: `nuevo.${counter}@incidapp.test`,
  };
}

const CASES = ROWS.flatMap((row) =>
  WHO.map((who, i) => ({ row, who, status: row.expected[i] as number })),
);

describe('CA-02.15: matriz de autorización de /api/users y /api/departments', () => {
  it.each(CASES.map((c) => [c.row.name, c.row.method, c.who, c.status, c] as const))(
    '%s · %s · %s → %i',
    async (_name, _method, _who, status, c) => {
      const context = await freshContext();
      const token = c.who === 'none' ? undefined : api.tokens[c.who];
      const response = await api.call(c.row.method, c.row.path(context), {
        token,
        payload: c.row.body?.(context),
      });
      expect(response.statusCode).toBe(status);
    },
  );
});

describe('CA-02.4/CA-02.15: coherencia de allowedActions con lo que la API permite', () => {
  it.each([
    ['ADMIN', true],
    ['DIRECTOR', false],
    ['MANAGER', false],
    ['USER', false],
  ] as const)(
    'CA-02.4: %s anuncia manageUsers=%s y GET /api/users coincide',
    async (role, announced) => {
      const me = await api.call('GET', '/api/auth/me', { token: api.tokens[role] });
      const actions = (me.json() as { allowedActions: string[] }).allowedActions;
      expect(actions.includes('manageUsers')).toBe(announced);
      const list = await api.call('GET', '/api/users', { token: api.tokens[role] });
      expect(list.statusCode).toBe(announced ? 200 : 403);
    },
  );

  it.each([
    ['ADMIN', ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard']],
    ['DIRECTOR', ['viewDashboard']],
    ['MANAGER', ['createIncident']],
    ['USER', ['createIncident']],
  ] as const)('CA-02.4: acciones globales de %s según permisos.md', async (role, expected) => {
    const me = await api.call('GET', '/api/auth/me', { token: api.tokens[role] });
    const actions = (me.json() as { allowedActions: string[] }).allowedActions;
    expect([...actions].sort()).toEqual([...expected].sort());
  });
});
