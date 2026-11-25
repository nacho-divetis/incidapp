// Matriz de autorización de la API (CA-02.15): endpoint × {sin sesión, ADMIN, DIRECTOR, MANAGER, USER}.
// Fuente de verdad: `docs/permisos.md`. F03 y F04 añaden filas a `ROWS` (o tablas análogas) con
// incidencias visibles y no visibles. Cada caso usa un usuario destino nuevo para no depender del orden.
import { DEMO_USERS, IncidentEventList, type Role } from '@incidapp/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeLogin } from '../application/auth/login';
import { makeLogout } from '../application/auth/logout';
import { makeResolveSession } from '../application/auth/resolve-session';
import { FakePasswordHasher, FixedClock } from '../application/auth/test-fakes';
import { makeListDepartments } from '../application/departments/list-departments';
import { makeAssignIncident } from '../application/incidents/assign-incident';
import { makeCreateIncident } from '../application/incidents/create-incident';
import { makeGetIncident } from '../application/incidents/get-incident';
import { makeListAssignees } from '../application/incidents/list-assignees';
import { makeListIncidentTypes } from '../application/incidents/list-incident-types';
import { makeListIncidents } from '../application/incidents/list-incidents';
import { makeUpdateIncident } from '../application/incidents/update-incident';
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
import { createDrizzleIncidentRepository } from '../infrastructure/db/repositories/incident-repository';
import { createDrizzleIncidentTypeRepository } from '../infrastructure/db/repositories/incident-type-repository';
import { createDrizzleSessionRepository } from '../infrastructure/db/repositories/session-repository';
import { createDrizzleUserAdminRepository } from '../infrastructure/db/repositories/user-admin-repository';
import { createDrizzleUserRepository } from '../infrastructure/db/repositories/user-repository';
import {
  departments,
  incidents,
  incidentTypes,
  userDepartments,
  users,
} from '../infrastructure/db/schema';
import { seedDatabase } from '../infrastructure/db/seed';
import { createTestDatabase } from '../infrastructure/db/test-database';
import { createDrizzleUnitOfWork } from '../infrastructure/db/unit-of-work';
import { buildApp } from './app';
import { makeChangeIncidentStatus } from '../application/incidents/change-incident-status';
import { makeListIncidentEvents } from '../application/incidents/list-incident-events';
import { createDrizzleIncidentEventReader } from '../infrastructure/db/repositories/incident-event-reader';
import {
  createAuthzClient,
  unusedAdmin,
  unusedIncidents,
  validIncidentBody,
  type AuthzClient,
} from './test-support';

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

// --- Incidencias (CA-03.11) ------------------------------------------------------------------------
// Cada caso crea su propia incidencia: ningún test depende del estado que dejó otro.

type Creator = 'ADMIN' | 'MANAGER' | 'USER';

interface Harness {
  api: AuthzClient;
  database: DatabaseHandle;
  close: () => Promise<void>;
  typeId: Record<string, string>;
  userId: Record<Role, string>;
  /** Usuario activo del departamento CAL (candidato a asignar en las incidencias de CAL). */
  calUserId: string;
}

async function startHarness(): Promise<Harness> {
  const database = await createTestDatabase();
  const passwordHasher = new FakePasswordHasher();
  await seedDatabase(database.db, { passwordHasher });
  const clock = new FixedClock(new Date('2026-11-25T10:00:00.000Z'));
  const authDeps = {
    users: createDrizzleUserRepository(database.db),
    sessions: createDrizzleSessionRepository(database.db),
    auditLog: createDrizzleAuditLogWriter(database.db),
    passwordHasher,
    sessionTokens: createSessionTokens(),
    clock,
  };
  const incidentDeps = {
    incidents: createDrizzleIncidentRepository(database.db),
    incidentTypes: createDrizzleIncidentTypeRepository(database.db),
    incidentEvents: createDrizzleIncidentEventReader(database.db),
    users: createDrizzleUserAdminRepository(database.db),
    unitOfWork: createDrizzleUnitOfWork(database.db),
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
    ...unusedAdmin,
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
    enforceHttps: false,
    logger: false,
  });
  const api = await createAuthzClient(app);
  const typeId = Object.fromEntries(
    (await database.db.select().from(incidentTypes)).map((t) => [t.code, t.id]),
  );
  const userRows = await database.db.select().from(users);
  const userId = Object.fromEntries(
    DEMO_USERS.map((demo) => [demo.role, userRows.find((r) => r.email === demo.email)!.id]),
  ) as Record<Role, string>;
  const [cal] = await database.db.select().from(departments).where(eq(departments.code, 'CAL'));
  const [calUser] = await database.db
    .insert(users)
    .values({
      email: 'calidad.activo@incidapp.test',
      name: 'Usuario de Calidad',
      role: 'USER',
      passwordHash: 'sin-uso',
    })
    .returning();
  await database.db.insert(userDepartments).values({ userId: calUser!.id, departmentId: cal!.id });
  return {
    api,
    database,
    typeId,
    userId,
    calUserId: calUser!.id,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

/**
 * Relación de la incidencia con el Responsable (dpto. LOG) y el Usuario (dpto. LOG) demo, y lo que
 * `permisos.md` les permite (tabla escrita a mano, no derivada del código). Admin: todo; Dirección:
 * solo ver. `type`: TRANSPORT (dpto. LOG, el de ambos) o QUALITY (dpto. CAL, ajeno a ambos).
 */
interface Relation {
  name: string;
  type: 'TRANSPORT' | 'QUALITY';
  creator: Creator;
  status: 'OPEN' | 'IN_PROGRESS';
  assignedTo?: 'MANAGER' | 'USER';
  /** [Responsable, Usuario] */
  view: readonly [boolean, boolean];
  edit: readonly [boolean, boolean];
  assign: readonly [boolean, boolean];
}

const RELATIONS: Relation[] = [
  {
    name: 'de sus dptos., creada por el Admin',
    type: 'TRANSPORT',
    creator: 'ADMIN',
    status: 'OPEN',
    view: [true, true],
    edit: [true, false],
    assign: [true, false],
  },
  {
    name: 'de sus dptos., creada por el Usuario y ABIERTA',
    type: 'TRANSPORT',
    creator: 'USER',
    status: 'OPEN',
    view: [true, true],
    edit: [true, true],
    assign: [true, false],
  },
  {
    name: 'de sus dptos., creada por el Usuario y EN CURSO',
    type: 'TRANSPORT',
    creator: 'USER',
    status: 'IN_PROGRESS',
    view: [true, true],
    edit: [true, false],
    assign: [true, false],
  },
  {
    name: 'ajena, creada por el Usuario y ABIERTA',
    type: 'QUALITY',
    creator: 'USER',
    status: 'OPEN',
    view: [false, true],
    edit: [false, true],
    assign: [false, false],
  },
  {
    name: 'ajena, creada por el Responsable y ABIERTA (nota 2)',
    type: 'QUALITY',
    creator: 'MANAGER',
    status: 'OPEN',
    view: [true, false],
    edit: [true, false],
    assign: [false, false],
  },
  {
    name: 'ajena, creada por el Responsable y EN CURSO (nota 2)',
    type: 'QUALITY',
    creator: 'MANAGER',
    status: 'IN_PROGRESS',
    view: [true, false],
    edit: [false, false],
    assign: [false, false],
  },
  {
    name: 'ajena, asignada al Usuario',
    type: 'QUALITY',
    creator: 'ADMIN',
    status: 'OPEN',
    assignedTo: 'USER',
    view: [false, true],
    edit: [false, false],
    assign: [false, false],
  },
  {
    name: 'ajena, asignada al Responsable (nota 2)',
    type: 'QUALITY',
    creator: 'ADMIN',
    status: 'OPEN',
    assignedTo: 'MANAGER',
    view: [true, false],
    edit: [false, false],
    assign: [false, false],
  },
  {
    name: 'de sus dptos., asignada al Usuario',
    type: 'TRANSPORT',
    creator: 'ADMIN',
    status: 'OPEN',
    assignedTo: 'USER',
    view: [true, true],
    edit: [true, false],
    assign: [true, false],
  },
  {
    name: 'de sus dptos., creada por el Responsable',
    type: 'TRANSPORT',
    creator: 'MANAGER',
    status: 'OPEN',
    view: [true, true],
    edit: [true, false],
    assign: [true, false],
  },
  {
    name: 'ajena, sin relación',
    type: 'QUALITY',
    creator: 'ADMIN',
    status: 'OPEN',
    view: [false, false],
    edit: [false, false],
    assign: [false, false],
  },
];

/** Crea por la API una incidencia con la relación indicada (estado y asignado, directo en la BD). */
async function createRelated(h: Harness, rel: Relation, title = 'Incidencia de la matriz') {
  const response = await h.api.call('POST', '/api/incidents', {
    token: h.api.tokens[rel.creator],
    payload: validIncidentBody(h.typeId[rel.type]!, title),
  });
  expect(response.statusCode).toBe(201);
  const id = (response.json() as { id: string }).id;
  const patch = {
    ...(rel.status === 'OPEN' ? {} : { status: rel.status }),
    ...(rel.assignedTo ? { assignedTo: h.userId[rel.assignedTo] } : {}),
  };
  if (Object.keys(patch).length > 0) {
    await h.database.db.update(incidents).set(patch).where(eq(incidents.id, id));
  }
  return id;
}

/** Candidato a asignar válido: un usuario activo del departamento propietario. */
const assigneeFor = (h: Harness, rel: Relation) =>
  rel.type === 'TRANSPORT' ? h.userId.USER : h.calUserId;

/** [sin sesión, ADMIN, DIRECTOR, MANAGER, USER] de una acción que requiere permiso de `kind`. */
function codesFor(ok: number, rel: Relation, kind: 'edit' | 'assign'): Expected {
  const forRole = (i: 0 | 1) => (!rel.view[i] ? 404 : rel[kind][i] ? ok : 403);
  return [401, ok, 403, forRole(0), forRole(1)];
}

const visibleCodes = (rel: Relation): Expected => [
  401,
  200,
  200,
  rel.view[0] ? 200 : 404,
  rel.view[1] ? 200 : 404,
];

interface IncidentEndpoint {
  name: string;
  method: 'GET' | 'PATCH' | 'POST';
  path: (id: string) => string;
  body?: (h: Harness, rel: Relation) => unknown;
  expected: (rel: Relation) => Expected;
}

const INCIDENT_ENDPOINTS: IncidentEndpoint[] = [
  {
    name: 'CA-03.6: ver el detalle',
    method: 'GET',
    path: (id) => `/api/incidents/${id}`,
    expected: visibleCodes,
  },
  {
    name: 'CA-03.9: editar campos',
    method: 'PATCH',
    path: (id) => `/api/incidents/${id}`,
    body: () => ({ title: 'Título editado' }),
    expected: (rel) => codesFor(200, rel, 'edit'),
  },
  {
    // La forma del cuerpo se valida antes de buscar la incidencia (no revela nada): 400 a todos con sesión.
    name: 'CA-03.9: cuerpo vacío al editar (400 con sesión, antes que 403/404)',
    method: 'PATCH',
    path: (id) => `/api/incidents/${id}`,
    body: () => ({}),
    expected: () => [401, 400, 400, 400, 400],
  },
  {
    name: 'CA-03.10: listar candidatos a asignar',
    method: 'GET',
    path: (id) => `/api/incidents/${id}/assignees`,
    expected: (rel) => codesFor(200, rel, 'assign'),
  },
  {
    name: 'CA-03.10: asignar',
    method: 'POST',
    path: (id) => `/api/incidents/${id}/assign`,
    body: (h, rel) => ({ assigneeId: assigneeFor(h, rel) }),
    expected: (rel) => codesFor(200, rel, 'assign'),
  },
  {
    name: 'CA-03.10: asignar a un usuario de otro dpto. (400 solo si puede asignar)',
    method: 'POST',
    path: (id) => `/api/incidents/${id}/assign`,
    body: (h, rel) => ({ assigneeId: rel.type === 'TRANSPORT' ? h.calUserId : h.userId.USER }),
    expected: (rel) => codesFor(400, rel, 'assign'),
  },
];

describe('CA-03.11: matriz de autorización de /api/incidents por relación con la incidencia', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });

  const cases = INCIDENT_ENDPOINTS.flatMap((endpoint) =>
    RELATIONS.flatMap((rel) =>
      WHO.map((who, i) => ({ endpoint, rel, who, status: endpoint.expected(rel)[i] as number })),
    ),
  );

  it.each(
    cases.map((c) => [c.endpoint.name, c.endpoint.method, c.rel.name, c.who, c.status, c] as const),
  )('%s · %s · incidencia %s · %s → %i', async (_n, _m, _r, _w, status, c) => {
    const id = await createRelated(h, c.rel);
    const response = await h.api.call(c.endpoint.method, c.endpoint.path(id), {
      token: c.who === 'none' ? undefined : h.api.tokens[c.who],
      payload: c.endpoint.body?.(h, c.rel),
    });
    expect(response.statusCode).toBe(status);
  });

  // Incidencia inexistente o con id que no es UUID: 404 para todos los que tienen sesión.
  it.each(
    [MISSING_ID, 'no-es-uuid'].flatMap((id) =>
      INCIDENT_ENDPOINTS.filter((e) => !e.name.startsWith('CA-03.9: cuerpo vacío')).flatMap((e) =>
        ROLES.map((role) => [e.name, e.method, id, role] as const),
      ),
    ),
  )('CA-03.6: %s · %s · id %s · %s → 404', async (name, method, id, role) => {
    const endpoint = INCIDENT_ENDPOINTS.find((e) => e.name === name && e.method === method)!;
    const response = await h.api.call(method, endpoint.path(id), {
      token: h.api.tokens[role],
      payload: endpoint.body?.(h, RELATIONS[0]!),
    });
    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['ADMIN', 201],
    ['DIRECTOR', 403],
    ['MANAGER', 201],
    ['USER', 201],
  ] as const)('CA-03.5: %s crea una incidencia → %i', async (role, status) => {
    const response = await h.api.call('POST', '/api/incidents', {
      token: h.api.tokens[role],
      payload: validIncidentBody(h.typeId.TRANSPORT!),
    });
    expect(response.statusCode).toBe(status);
  });

  it('CA-03.5: crear sin sesión → 401', async () => {
    const response = await h.api.call('POST', '/api/incidents', {
      payload: validIncidentBody(h.typeId.TRANSPORT!),
    });
    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['ADMIN', 400],
    ['DIRECTOR', 403],
    ['MANAGER', 400],
    ['USER', 400],
  ] as const)('CA-03.5: %s con cuerpo inválido al crear → %i', async (role, status) => {
    const response = await h.api.call('POST', '/api/incidents', {
      token: h.api.tokens[role],
      payload: { title: '' },
    });
    expect(response.statusCode).toBe(status);
  });

  it('CA-03.2: catálogo de tipos de incidencia sin sesión → 401', async () => {
    expect((await h.api.call('GET', '/api/incident-types')).statusCode).toBe(401);
  });

  it.each(ROLES)('CA-03.2: %s consulta el catálogo de tipos → 200', async (role) => {
    const response = await h.api.call('GET', '/api/incident-types', { token: h.api.tokens[role] });
    expect(response.statusCode).toBe(200);
  });

  it('CA-03.7: listar sin sesión → 401', async () => {
    expect((await h.api.call('GET', '/api/incidents')).statusCode).toBe(401);
  });

  it.each(ROLES)('CA-03.7: %s lista incidencias → 200', async (role) => {
    const response = await h.api.call('GET', '/api/incidents', { token: h.api.tokens[role] });
    expect(response.statusCode).toBe(200);
  });
});

describe('CA-03.11: el listado solo incluye incidencias visibles', () => {
  let h: Harness;
  const ids: string[] = [];
  beforeAll(async () => {
    h = await startHarness();
    for (const rel of RELATIONS) ids.push(await createRelated(h, rel));
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });

  async function listed(role: Role, query = ''): Promise<{ ids: string[]; total: number }> {
    const response = await h.api.call('GET', `/api/incidents?${query}`, {
      token: h.api.tokens[role],
    });
    expect(response.statusCode).toBe(200);
    const json = response.json() as { items: { id: string }[]; total: number };
    return { ids: json.items.map((i) => i.id), total: json.total };
  }

  it.each([
    ['ADMIN', () => RELATIONS.map(() => true)],
    ['DIRECTOR', () => RELATIONS.map(() => true)],
    ['MANAGER', () => RELATIONS.map((r) => r.view[0])],
    ['USER', () => RELATIONS.map((r) => r.view[1])],
  ] as const)(
    'CA-03.7: el listado de %s contiene exactamente las visibles',
    async (role, visible) => {
      const expected = ids.filter((_id, i) => visible()[i]);
      const result = await listed(role);
      expect([...result.ids].sort()).toEqual([...expected].sort());
      expect(result.total).toBe(expected.length);
    },
  );

  it.each([
    ['MANAGER', 0],
    ['USER', 1],
  ] as const)(
    'CA-03.8: %s no amplía lo visible filtrando por un departamento ajeno',
    async (role, index) => {
      const [cal] = await h.database.db
        .select()
        .from(departments)
        .where(eq(departments.code, 'CAL'));
      const result = await listed(role, `departmentId=${cal!.id}`);
      const expected = ids.filter(
        (_id, i) => RELATIONS[i]!.type === 'QUALITY' && RELATIONS[i]!.view[index],
      );
      expect([...result.ids].sort()).toEqual([...expected].sort());
    },
  );
});

describe('CA-03.11: coherencia de allowedActions con lo que la API permite', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });

  const cases = RELATIONS.flatMap((rel) => ROLES.map((role) => [rel.name, role, rel] as const));

  it.each(cases)(
    'CA-03.6: incidencia %s · %s: lo anunciado se puede ejecutar (2xx) y lo no anunciado da 403',
    async (_name, role, rel) => {
      const token = h.api.tokens[role];
      const detail = await h.api.call('GET', `/api/incidents/${await createRelated(h, rel)}`, {
        token,
      });
      if (detail.statusCode === 404) {
        // no visible: no hay acciones que anunciar; y solo puede ocurrir si el Responsable o el Usuario no la ven
        expect(role === 'MANAGER' ? rel.view[0] : role === 'USER' ? rel.view[1] : true).toBe(false);
        return;
      }
      expect(detail.statusCode).toBe(200);
      const actions = (detail.json() as { allowedActions: string[] }).allowedActions;

      const edit = await h.api.call('PATCH', `/api/incidents/${await createRelated(h, rel)}`, {
        token,
        payload: { title: 'Título editado' },
      });
      expect(edit.statusCode).toBe(actions.includes('update') ? 200 : 403);

      const assignId = await createRelated(h, rel);
      const assign = await h.api.call('POST', `/api/incidents/${assignId}/assign`, {
        token,
        payload: { assigneeId: assigneeFor(h, rel) },
      });
      expect(assign.statusCode).toBe(actions.includes('assign') ? 200 : 403);
      const candidates = await h.api.call('GET', `/api/incidents/${assignId}/assignees`, { token });
      expect(candidates.statusCode).toBe(actions.includes('assign') ? 200 : 403);
    },
  );
});

describe('CA-03.2/CA-03.9: campos que decide el servidor enviados por el cliente', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });

  it('CA-03.9: PATCH ignora status, typeId, assignedTo y code', async () => {
    const id = await createRelated(h, RELATIONS[0]!);
    const [before] = await h.database.db.select().from(incidents).where(eq(incidents.id, id));
    const response = await h.api.call('PATCH', `/api/incidents/${id}`, {
      token: h.api.tokens.ADMIN,
      payload: {
        title: 'Solo cambia el título',
        status: 'CLOSED',
        typeId: h.typeId.QUALITY,
        assignedTo: h.userId.USER,
        code: 'INC-1999-0001',
      },
    });
    expect(response.statusCode).toBe(200);
    const [row] = await h.database.db.select().from(incidents).where(eq(incidents.id, id));
    expect(row).toMatchObject({ status: 'OPEN', typeId: h.typeId.TRANSPORT, assignedTo: null });
    expect(row!.code).toBe(before!.code);
    expect(row!.title).toBe('Solo cambia el título');
  });

  it('CA-03.2: POST ignora status, code, createdBy, departmentId y assignedTo', async () => {
    const [cal] = await h.database.db.select().from(departments).where(eq(departments.code, 'CAL'));
    const [log] = await h.database.db.select().from(departments).where(eq(departments.code, 'LOG'));
    const response = await h.api.call('POST', '/api/incidents', {
      token: h.api.tokens.USER,
      payload: {
        ...validIncidentBody(h.typeId.TRANSPORT!),
        status: 'CLOSED',
        code: 'INC-1999-0001',
        createdBy: h.userId.ADMIN,
        assignedTo: h.userId.ADMIN,
        departmentId: cal!.id,
      },
    });
    expect(response.statusCode).toBe(201);
    const id = (response.json() as { id: string }).id;
    const [row] = await h.database.db.select().from(incidents).where(eq(incidents.id, id));
    expect(row).toMatchObject({
      status: 'OPEN',
      createdBy: h.userId.USER,
      assignedTo: null,
      departmentId: log!.id,
    });
    expect(row!.code).toMatch(/^INC-\d{4}-\d{4}$/);
    expect(row!.code).not.toBe('INC-1999-0001');
  });
});

// --- Transiciones e historial (CA-04.7, CA-04.4) ---------------------------------------------------
// Tabla escrita a mano desde `docs/permisos.md` (Transiciones de estado + nota 2), sin derivarla del código.

/** [Responsable, Usuario] por relación (incidencias ABIERTAS): ¿puede hacer la transición operativa / de gestión? */
const TRANSITION_PERMS: Record<
  string,
  { op: readonly [boolean, boolean]; mgmt: readonly [boolean, boolean] }
> = {
  'de sus dptos., creada por el Admin': { op: [true, false], mgmt: [true, false] },
  'de sus dptos., creada por el Usuario y ABIERTA': { op: [true, true], mgmt: [true, false] },
  'ajena, creada por el Usuario y ABIERTA': { op: [false, true], mgmt: [false, false] },
  // nota 2: Responsable fuera de sus dptos. que la creó o la tiene asignada: operativa sí, gestión 403
  'ajena, creada por el Responsable y ABIERTA (nota 2)': {
    op: [true, false],
    mgmt: [false, false],
  },
  'ajena, asignada al Usuario': { op: [false, true], mgmt: [false, false] },
  'ajena, asignada al Responsable (nota 2)': { op: [true, false], mgmt: [false, false] },
  'de sus dptos., asignada al Usuario': { op: [true, true], mgmt: [true, false] },
  'de sus dptos., creada por el Responsable': { op: [true, false], mgmt: [true, false] },
  'ajena, sin relación': { op: [false, false], mgmt: [false, false] },
};
const OPEN_RELATIONS = RELATIONS.filter((r) => r.status === 'OPEN');

/** [sin sesión, ADMIN, DIRECTOR, MANAGER, USER]: `ok` si puede, `denied` si ve y no puede, 404 si no ve. */
function transitionCodes(rel: Relation, kind: 'op' | 'mgmt', ok: number, denied = 403): Expected {
  const perms = TRANSITION_PERMS[rel.name]![kind];
  const forRole = (i: 0 | 1) => (!rel.view[i] ? 404 : perms[i] ? ok : denied);
  return [401, ok, denied, forRole(0), forRole(1)];
}

interface TransitionEndpoint {
  name: string;
  method: 'GET' | 'POST';
  path: (id: string) => string;
  body?: unknown;
  expected: (rel: Relation) => Expected;
}

const TRANSITION_ENDPOINTS: TransitionEndpoint[] = [
  {
    name: 'CA-04.7: transición operativa ABIERTA → EN CURSO',
    method: 'POST',
    path: (id) => `/api/incidents/${id}/transitions`,
    body: { to: 'IN_PROGRESS' },
    expected: (rel) => transitionCodes(rel, 'op', 200),
  },
  {
    name: 'CA-04.7: transición de gestión ABIERTA → RECHAZADA con comentario',
    method: 'POST',
    path: (id) => `/api/incidents/${id}/transitions`,
    body: { to: 'REJECTED', comment: 'Duplicada de otra incidencia' },
    expected: (rel) => transitionCodes(rel, 'mgmt', 200),
  },
  {
    // Orden 404 → 409 → 403 → 400: sin comentario, quien no puede el tipo recibe 403 antes que 400.
    name: 'CA-04.3: ABIERTA → RECHAZADA sin comentario (400 solo si puede; 403 antes que 400)',
    method: 'POST',
    path: (id) => `/api/incidents/${id}/transitions`,
    body: { to: 'REJECTED' },
    expected: (rel) => {
      const codes = transitionCodes(rel, 'mgmt', 400);
      return [codes[0], 400, 403, codes[3], codes[4]];
    },
  },
  {
    // La transición inexistente se evalúa antes que el permiso: 409 a todo el que ve la incidencia.
    name: 'CA-04.3: ABIERTA → CERRADA no existe (409 a quien la ve, antes que 403)',
    method: 'POST',
    path: (id) => `/api/incidents/${id}/transitions`,
    body: { to: 'CLOSED', comment: 'x' },
    expected: (rel) => [401, 409, 409, rel.view[0] ? 409 : 404, rel.view[1] ? 409 : 404],
  },
  {
    name: 'CA-04.6: leer el historial',
    method: 'GET',
    path: (id) => `/api/incidents/${id}/events`,
    expected: visibleCodes,
  },
];

describe('CA-04.7: matriz de autorización de transiciones e historial por relación', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });

  const cases = TRANSITION_ENDPOINTS.flatMap((endpoint) =>
    OPEN_RELATIONS.flatMap((rel) =>
      WHO.map((who, i) => ({ endpoint, rel, who, status: endpoint.expected(rel)[i] as number })),
    ),
  );

  it.each(
    cases.map((c) => [c.endpoint.name, c.endpoint.method, c.rel.name, c.who, c.status, c] as const),
  )('%s · %s · incidencia %s · %s → %i', async (_n, _m, _r, _w, status, c) => {
    const id = await createRelated(h, c.rel);
    const response = await h.api.call(c.endpoint.method, c.endpoint.path(id), {
      token: c.who === 'none' ? undefined : h.api.tokens[c.who],
      payload: c.endpoint.body,
    });
    expect(response.statusCode).toBe(status);
  });

  it.each(
    TRANSITION_ENDPOINTS.flatMap((e) =>
      [MISSING_ID, 'no-es-uuid'].flatMap((id) => ROLES.map((role) => [e.name, id, role] as const)),
    ),
  )('CA-04.3/CA-04.6: %s · id %s · %s → 404', async (name, id, role) => {
    const endpoint = TRANSITION_ENDPOINTS.find((e) => e.name === name)!;
    const response = await h.api.call(endpoint.method, endpoint.path(id), {
      token: h.api.tokens[role],
      payload: endpoint.body,
    });
    expect(response.statusCode).toBe(404);
  });

  it('CA-04.6: una transición correcta deja un evento STATUS_CHANGED en el historial', async () => {
    const id = await createRelated(h, OPEN_RELATIONS[1]!);
    const done = await h.api.call('POST', `/api/incidents/${id}/transitions`, {
      token: h.api.tokens.USER,
      payload: { to: 'IN_PROGRESS' },
    });
    expect(done.statusCode).toBe(200);
    const events = await h.api.call('GET', `/api/incidents/${id}/events`, {
      token: h.api.tokens.DIRECTOR,
    });
    // Forma real del contrato (IncidentEventList de shared): un array de eventos.
    const items = IncidentEventList.parse(events.json());
    // El reloj fijo da la misma fecha a ambos eventos (desempata el id): se compara sin orden.
    expect(items.map((e) => e.type).sort()).toEqual(['CREATED', 'STATUS_CHANGED']);
  });
});

// Estados de partida y transiciones existentes según `permisos.md` (a mano).
const STATES = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'REOPENED',
] as const;
type State = (typeof STATES)[number];

/** Por estado de partida: destinos operativos y de gestión que existen (tabla de permisos.md). */
const MACHINE: Record<State, { op: State[]; mgmt: State[] }> = {
  OPEN: { op: ['IN_PROGRESS'], mgmt: ['REJECTED'] },
  IN_PROGRESS: { op: ['PENDING_THIRD_PARTY', 'RESOLVED'], mgmt: [] },
  PENDING_THIRD_PARTY: { op: ['IN_PROGRESS'], mgmt: [] },
  RESOLVED: { op: [], mgmt: ['IN_PROGRESS', 'CLOSED'] },
  CLOSED: { op: [], mgmt: ['REOPENED'] },
  REJECTED: { op: [], mgmt: [] },
  REOPENED: { op: ['IN_PROGRESS'], mgmt: [] },
};
const COMMENT_REQUIRED = new Set([
  'OPEN>REJECTED',
  'IN_PROGRESS>RESOLVED',
  'RESOLVED>IN_PROGRESS',
  'CLOSED>REOPENED',
]);

/**
 * Qué anuncia `allowedTransitions` por rol sobre una incidencia de TRANSPORT (dpto. LOG) creada por el Usuario:
 * Admin y Responsable de LOG, todas; Usuario (creador), solo las operativas; Dirección, ninguna.
 */
const announcedBy = (role: Role, state: State): State[] => {
  const m = MACHINE[state];
  if (role === 'ADMIN' || role === 'MANAGER') return [...m.op, ...m.mgmt];
  if (role === 'USER') return m.op;
  return [];
};

describe('CA-04.4: allowedTransitions por rol y coherencia con POST …/transitions', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  }, 60_000);
  afterAll(async () => {
    await h.close();
  });

  /** Fuerza el estado directo en la BD: no genera eventos (solo el CREATED del alta). */
  async function createInState(state: State): Promise<string> {
    const id = await createRelated(h, OPEN_RELATIONS[1]!);
    if (state !== 'OPEN') {
      await h.database.db.update(incidents).set({ status: state }).where(eq(incidents.id, id));
    }
    return id;
  }

  const roleStates = STATES.flatMap((state) => ROLES.map((role) => [state, role] as const));

  it.each(roleStates)(
    'CA-04.4: desde %s, %s recibe exactamente las transiciones de permisos.md',
    async (state, role) => {
      const id = await createInState(state);
      const detail = await h.api.call('GET', `/api/incidents/${id}`, { token: h.api.tokens[role] });
      expect(detail.statusCode).toBe(200);
      const transitions = (
        detail.json() as { allowedTransitions: { to: State; requiresComment: boolean }[] }
      ).allowedTransitions;
      expect(transitions.map((t) => t.to).sort()).toEqual([...announcedBy(role, state)].sort());
      for (const t of transitions) {
        expect(t.requiresComment).toBe(COMMENT_REQUIRED.has(`${state}>${t.to}`));
      }
    },
  );

  // Por cada relación abierta que ve la incidencia, el detalle anuncia lo que dice TRANSITION_PERMS.
  it.each(
    OPEN_RELATIONS.flatMap((rel) =>
      ([0, 1] as const)
        .filter((i) => rel.view[i])
        .map((i) => [rel.name, i === 0 ? 'MANAGER' : 'USER', rel, i] as const),
    ),
  )(
    'CA-04.4: incidencia %s · %s: allowedTransitions según TRANSITION_PERMS',
    async (_n, role, rel, i) => {
      const id = await createRelated(h, rel);
      const detail = await h.api.call('GET', `/api/incidents/${id}`, { token: h.api.tokens[role] });
      expect(detail.statusCode).toBe(200);
      const transitions = (
        detail.json() as { allowedTransitions: { to: State; requiresComment: boolean }[] }
      ).allowedTransitions;
      const perms = TRANSITION_PERMS[rel.name]!;
      const expected = [
        ...(perms.op[i] ? [{ to: 'IN_PROGRESS', requiresComment: false }] : []),
        ...(perms.mgmt[i] ? [{ to: 'REJECTED', requiresComment: true }] : []),
      ];
      expect([...transitions].sort((x, y) => x.to.localeCompare(y.to))).toEqual(
        expected.sort((x, y) => x.to.localeCompare(y.to)),
      );
    },
  );

  it.each(roleStates.flatMap(([state, role]) => STATES.map((to) => [state, role, to] as const)))(
    'CA-04.4: desde %s, %s hace → %s solo si lo anuncia (200); si existe y no lo anuncia, 403; si no existe, 409',
    async (state, role, to) => {
      const token = h.api.tokens[role];
      const id = await createInState(state);
      const detail = await h.api.call('GET', `/api/incidents/${id}`, { token });
      const announced = (detail.json() as { allowedTransitions: { to: State }[] })
        .allowedTransitions;
      const exists = [...MACHINE[state].op, ...MACHINE[state].mgmt].includes(to);
      const response = await h.api.call('POST', `/api/incidents/${id}/transitions`, {
        token,
        payload: { to, comment: 'Comentario de prueba' },
      });
      const expected = announced.some((t) => t.to === to) ? 200 : exists ? 403 : 409;
      expect(response.statusCode).toBe(expected);
      if (expected === 200) {
        expect((response.json() as { status: string }).status).toBe(to);
      }
    },
  );
});
