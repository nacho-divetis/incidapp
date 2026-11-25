// Tests de punta a punta de `/api/users` y `/api/departments` con `fastify.inject`: casos de uso,
// repositorios Drizzle sobre PGlite en memoria con el *seed*, argon2id real y reloj fijo
// (CA-02.4 a CA-02.14). La matriz completa rol × endpoint es de T-02.04.
import { Writable } from 'node:stream';
import {
  CurrentUser,
  DEMO_PASSWORD,
  DEMO_USERS,
  DepartmentSummary,
  ErrorResponse,
  UserAdmin,
} from '@incidapp/shared';
import { and, eq, notInArray } from 'drizzle-orm';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { z } from 'zod';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeLogin } from '../../application/auth/login';
import { makeLogout } from '../../application/auth/logout';
import { makeResolveSession } from '../../application/auth/resolve-session';
import { FixedClock } from '../../application/auth/test-fakes';
import { makeListDepartments } from '../../application/departments/list-departments';
import { makeCreateUser } from '../../application/users/create-user';
import { makeGetUser } from '../../application/users/get-user';
import { makeListUsers } from '../../application/users/list-users';
import { makeResetUserPassword } from '../../application/users/reset-user-password';
import { makeSetUserActive } from '../../application/users/set-user-active';
import { makeUpdateUser } from '../../application/users/update-user';
import { createArgon2PasswordHasher } from '../../infrastructure/auth/argon2-password-hasher';
import { createSessionTokens } from '../../infrastructure/auth/session-tokens';
import type { DatabaseHandle } from '../../infrastructure/db/client';
import { createDrizzleAuditLogWriter } from '../../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleDepartmentRepository } from '../../infrastructure/db/repositories/department-repository';
import { createDrizzleSessionRepository } from '../../infrastructure/db/repositories/session-repository';
import { createDrizzleUserAdminRepository } from '../../infrastructure/db/repositories/user-admin-repository';
import { createDrizzleUserRepository } from '../../infrastructure/db/repositories/user-repository';
import { auditLog, departments, sessions, users } from '../../infrastructure/db/schema';
import { DEPARTMENTS, seedDatabase } from '../../infrastructure/db/seed';
import { createTestDatabase } from '../../infrastructure/db/test-database';
import { createDrizzleUnitOfWork } from '../../infrastructure/db/unit-of-work';
import { buildApp } from '../app';

const T0 = new Date('2026-11-23T10:00:00.000Z');
const CSRF = { 'x-requested-with': 'fetch' };
const IP = '203.0.113.20';
const DEMO_EMAILS = DEMO_USERS.map((user) => user.email);
const demo = (role: string) => DEMO_USERS.find((user) => user.role === role)!;
const ADMIN = demo('ADMIN');
const DIRECTOR = demo('DIRECTOR');
const MANAGER = demo('MANAGER');
const USER = demo('USER');
const NEW_PASSWORD = 'Clave-Nueva-2026';
const MISSING_ID = '00000000-0000-4000-8000-00000000ffff';

const DEMO_MESSAGE = 'Los usuarios demo no se pueden modificar.';
const SELF_MESSAGE = 'No puedes desactivarte ni quitarte el rol de Admin a ti mismo.';
const EMAIL_TAKEN = 'Ya existe un usuario con ese email.';

const argon2 = createArgon2PasswordHasher();

let database: DatabaseHandle;
let app: FastifyInstance;
let logLines: string[];

beforeAll(async () => {
  database = await createTestDatabase();
  await seedDatabase(database.db, { passwordHasher: argon2 });
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  // Cada test parte del *seed*: sin sesiones, sin auditoría, sin usuarios creados y con los demo
  // activos y con su nombre.
  await database.db.delete(sessions);
  await database.db.delete(auditLog);
  await database.db.delete(users).where(notInArray(users.email, DEMO_EMAILS));
  for (const user of DEMO_USERS) {
    await database.db
      .update(users)
      .set({ name: user.name, active: true })
      .where(eq(users.email, user.email));
  }

  logLines = [];
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logLines.push(chunk.toString());
      callback();
    },
  });

  const clock = new FixedClock(T0);
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
  app = await buildApp({
    getHealth: async () => ({ status: 'ok', db: 'ok', version: '0.1.0' }),
    auth: {
      login: makeLogin(authDeps),
      logout: makeLogout(authDeps),
      resolveSession: makeResolveSession(authDeps),
      loginRateLimit: { max: 1000, timeWindowMs: 60_000 },
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
    enforceHttps: false,
    logger: { level: 'trace', stream: logStream },
  });
});

afterEach(async () => {
  await app.close();
});

// --- Ayudas -------------------------------------------------------------------------------------

interface CallOptions {
  token?: string | undefined;
  payload?: unknown;
}

function call(
  method: InjectOptions['method'],
  url: string,
  { token, payload }: CallOptions = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method,
    url,
    headers: CSRF,
    remoteAddress: IP,
    cookies: token === undefined ? {} : { incidapp_session: token },
    ...(payload === undefined ? {} : { payload: payload as InjectOptions['payload'] }),
  });
}

async function login(email: string, password = DEMO_PASSWORD): Promise<LightMyRequestResponse> {
  return call('POST', '/api/auth/login', { payload: { email, password } });
}

/** Inicia sesión y devuelve el *token* de la cookie. */
async function loginAs(email: string, password = DEMO_PASSWORD): Promise<string> {
  const response = await login(email, password);
  expect(response.statusCode).toBe(200);
  const token = response.cookies.find((cookie) => cookie.name === 'incidapp_session')?.value;
  if (!token) throw new Error('El login no ha fijado la cookie de sesión.');
  return token;
}

async function departmentId(code: string): Promise<string> {
  const [row] = await database.db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.code, code));
  return row!.id;
}

async function userIdOf(email: string): Promise<string> {
  const [row] = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return row!.id;
}

const userRow = async (id: string) =>
  (await database.db.select().from(users).where(eq(users.id, id)))[0];

const auditRows = () => database.db.select().from(auditLog);

/** Filas de auditoría de la gestión de usuarios (descarta los logins de las ayudas). */
const userAuditRows = async () =>
  (await auditRows()).filter((row) => row.action.startsWith('USER_'));

const sessionCount = async (userId: string) =>
  (await database.db.select().from(sessions).where(eq(sessions.userId, userId))).length;

async function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'rosa.navarro@incidapp.test',
    name: 'Rosa Navarro',
    role: 'MANAGER',
    departmentIds: [await departmentId('LOG'), await departmentId('CAL')],
    password: NEW_PASSWORD,
    ...overrides,
  };
}

/** Crea un usuario por la API como el Admin demo y lo devuelve. */
async function createUser(adminToken: string, overrides: Record<string, unknown> = {}) {
  const response = await call('POST', '/api/users', {
    token: adminToken,
    payload: await validCreateBody(overrides),
  });
  expect(response.statusCode).toBe(201);
  return UserAdmin.parse(response.json());
}

const errorOf = (response: LightMyRequestResponse) => ErrorResponse.parse(response.json()).error;

// --- CA-02.5 ------------------------------------------------------------------------------------

type Endpoint = [method: InjectOptions['method'], path: string, body?: Record<string, unknown>];

/** Todos los endpoints de `/api/users`, con un cuerpo válido donde lo hay. */
const userEndpoints = (id: string): Endpoint[] => [
  ['GET', '/api/users'],
  ['GET', `/api/users/${id}`],
  ['POST', '/api/users', { placeholder: true }],
  ['PATCH', `/api/users/${id}`, { name: 'Cambio' }],
  ['POST', `/api/users/${id}/deactivate`],
  ['POST', `/api/users/${id}/activate`],
  ['POST', `/api/users/${id}/password`, { password: NEW_PASSWORD }],
];

async function bodyFor(body: Record<string, unknown> | undefined) {
  if (body && 'placeholder' in body) return validCreateBody();
  return body;
}

describe('CA-02.5: solo el Admin gestiona usuarios', () => {
  it.each([DIRECTOR, MANAGER, USER])(
    'CA-02.5: $role recibe 403 FORBIDDEN en todos los endpoints de /api/users sin cambiar nada',
    async ({ email }) => {
      const token = await loginAs(email);
      const targetId = await userIdOf(USER.email);
      const before = await database.db.select().from(users);

      for (const [method, path, body] of userEndpoints(targetId)) {
        const response = await call(method, path, { token, payload: await bodyFor(body) });
        expect(response.statusCode, `${method} ${path}`).toBe(403);
        expect(errorOf(response).code).toBe('FORBIDDEN');
      }

      expect(await database.db.select().from(users)).toEqual(before);
      expect(await userAuditRows()).toEqual([]);
    },
  );

  it('CA-02.5: sin sesión responde 401 en todos los endpoints de /api/users', async () => {
    for (const [method, path, body] of userEndpoints(MISSING_ID)) {
      const response = await call(method, path, { payload: await bodyFor(body) });
      expect(response.statusCode, `${method} ${path}`).toBe(401);
      expect(errorOf(response).code).toBe('UNAUTHORIZED');
    }
  });

  it('CA-02.5: un no-Admin recibe 403 (no 404 ni 400) con un id inexistente, no UUID o un cuerpo inválido', async () => {
    const token = await loginAs(USER.email);

    const responses = await Promise.all([
      call('GET', `/api/users/${MISSING_ID}`, { token }),
      call('GET', '/api/users/no-es-un-uuid', { token }),
      call('PATCH', `/api/users/${MISSING_ID}`, { token, payload: { email: 'mal' } }),
      call('POST', '/api/users', { token, payload: {} }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([403, 403, 403, 403]);
  });

  it('CA-02.5: las respuestas de /api/users llevan cache-control: no-store, también los errores', async () => {
    const adminToken = await loginAs(ADMIN.email);
    const userToken = await loginAs(USER.email);

    expect((await call('GET', '/api/users', { token: adminToken })).headers['cache-control']).toBe(
      'no-store',
    );
    expect((await call('GET', '/api/users', { token: userToken })).headers['cache-control']).toBe(
      'no-store',
    );
    expect(
      (await call('GET', `/api/users/${MISSING_ID}`, { token: adminToken })).headers[
        'cache-control'
      ],
    ).toBe('no-store');
  });
});

// --- CA-02.6 ------------------------------------------------------------------------------------

describe('CA-02.6: listado y detalle', () => {
  it('CA-02.6: GET /api/users devuelve todos (activos y desactivados) ordenados por nombre, sin hash', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token, { name: 'Zoe Martín', email: 'zoe@incidapp.test' });
    await call('POST', `/api/users/${created.id}/deactivate`, { token });

    const response = await call('GET', '/api/users', { token });

    expect(response.statusCode).toBe(200);
    const list = z.array(UserAdmin).parse(response.json());
    expect(list.map((user) => [user.name, user.active])).toEqual([
      ['Carmen Vidal', true],
      ['Elena Ruiz', true],
      ['Javier Ortega', true],
      ['Pablo Moreno', true],
      ['Zoe Martín', false],
    ]);
    const raw = response.json<Record<string, unknown>[]>();
    expect(Object.keys(raw[0]!).sort()).toEqual([
      'active',
      'allowedActions',
      'createdAt',
      'departments',
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(response.body).not.toMatch(/argon2|passwordHash/i);
  });

  it('CA-02.6: GET /api/users/:id devuelve el mismo formato que el listado', async () => {
    const token = await loginAs(ADMIN.email);
    const id = await userIdOf(MANAGER.email);
    const listed = z
      .array(UserAdmin)
      .parse((await call('GET', '/api/users', { token })).json())
      .find((user) => user.id === id);

    const response = await call('GET', `/api/users/${id}`, { token });

    expect(response.statusCode).toBe(200);
    expect(UserAdmin.parse(response.json())).toEqual(listed);
    expect(listed).toMatchObject({
      email: MANAGER.email,
      role: 'MANAGER',
      departments: [{ code: 'LOG', name: 'Logística y Almacén', id: await departmentId('LOG') }],
      allowedActions: ['rename'],
    });
  });

  it.each([
    ['no existe', MISSING_ID],
    ['no es un UUID', 'no-es-un-uuid'],
  ])('CA-02.6: si el id %s responde 404 NOT_FOUND', async (_case, id) => {
    const token = await loginAs(ADMIN.email);

    const response = await call('GET', `/api/users/${id}`, { token });

    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('NOT_FOUND');
  });
});

// --- CA-02.7 ------------------------------------------------------------------------------------

describe('CA-02.7: alta de un usuario', () => {
  it('CA-02.7: responde 201 con el usuario activo, el email normalizado y el hash argon2id', async () => {
    const token = await loginAs(ADMIN.email);

    const response = await call('POST', '/api/users', {
      token,
      payload: await validCreateBody({ email: '  Rosa.Navarro@IncidApp.TEST ' }),
    });

    expect(response.statusCode).toBe(201);
    const created = UserAdmin.parse(response.json());
    expect(created).toMatchObject({
      email: 'rosa.navarro@incidapp.test',
      name: 'Rosa Navarro',
      role: 'MANAGER',
      active: true,
      createdAt: T0.toISOString(),
    });
    expect(created.departments.map((d) => d.code)).toEqual(['CAL', 'LOG']);
    const row = await userRow(created.id);
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(row!.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(response.body).not.toContain(NEW_PASSWORD);
  });

  it('CA-02.7: el usuario creado puede iniciar sesión con su contraseña', async () => {
    const token = await loginAs(ADMIN.email);
    await createUser(token);

    const response = await login('rosa.navarro@incidapp.test', NEW_PASSWORD);

    expect(response.statusCode).toBe(200);
    expect(CurrentUser.parse(response.json()).role).toBe('MANAGER');
  });

  it('CA-02.7: los campos que decide el servidor se ignoran', async () => {
    const token = await loginAs(ADMIN.email);

    const created = await createUser(token, {
      id: MISSING_ID,
      active: false,
      createdAt: '2020-01-01T00:00:00.000Z',
      passwordHash: '$argon2id$inyectado',
    });

    expect(created.id).not.toBe(MISSING_ID);
    expect(created.active).toBe(true);
    expect(created.createdAt).toBe(T0.toISOString());
    expect((await userRow(created.id))?.passwordHash).not.toBe('$argon2id$inyectado');
  });

  it.each([
    ['sin email', { email: undefined }, 'email', 'El email es obligatorio.'],
    ['con un email no válido', { email: 'no-es-un-email' }, 'email', 'El email no es válido.'],
    ['con el nombre vacío', { name: '   ' }, 'name', 'El nombre es obligatorio.'],
    [
      'con un nombre de 101 caracteres',
      { name: 'a'.repeat(101) },
      'name',
      'El nombre no puede tener más de 100 caracteres.',
    ],
    [
      'con una contraseña de 7 caracteres',
      { password: 'a'.repeat(7) },
      'password',
      'La contraseña debe tener al menos 8 caracteres.',
    ],
    [
      'con una contraseña de 201 caracteres',
      { password: 'a'.repeat(201) },
      'password',
      'La contraseña no puede tener más de 200 caracteres.',
    ],
    ['sin rol', { role: undefined }, 'role', 'El rol es obligatorio.'],
    [
      'sin departamentos',
      { departmentIds: [] },
      'departmentIds',
      'Selecciona al menos un departamento.',
    ],
    [
      'con un departamento que no existe',
      { departmentIds: [MISSING_ID] },
      'departmentIds',
      'Alguno de los departamentos no existe.',
    ],
  ])(
    'CA-02.7: %s responde 400 VALIDATION con details en español y no crea nada',
    async (_case, overrides, path, message) => {
      const token = await loginAs(ADMIN.email);

      const response = await call('POST', '/api/users', {
        token,
        payload: await validCreateBody(overrides),
      });

      expect(response.statusCode).toBe(400);
      const error = errorOf(response);
      expect(error.code).toBe('VALIDATION');
      expect(error.details).toContainEqual({ path, message });
      expect(await database.db.select().from(users)).toHaveLength(DEMO_USERS.length);
    },
  );

  it.each([
    ['de un usuario activo', false],
    ['de un usuario desactivado', true],
  ])(
    'CA-02.7: un email ya registrado (%s) responde 409 CONFLICT sin crear nada',
    async (_case, deactivate) => {
      const token = await loginAs(ADMIN.email);
      const existing = await createUser(token, { email: 'repetido@incidapp.test' });
      if (deactivate) await call('POST', `/api/users/${existing.id}/deactivate`, { token });

      const response = await call('POST', '/api/users', {
        token,
        payload: await validCreateBody({ email: 'REPETIDO@incidapp.test', name: 'Otra' }),
      });

      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toEqual({ code: 'CONFLICT', message: EMAIL_TAKEN });
      expect(await database.db.select().from(users)).toHaveLength(DEMO_USERS.length + 1);
    },
  );
});

// --- CA-02.8 ------------------------------------------------------------------------------------

describe('CA-02.8: edición de un usuario', () => {
  it('CA-02.8: cambia nombre, email, rol y departamentos (que sustituyen a los anteriores)', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);

    const response = await call('PATCH', `/api/users/${created.id}`, {
      token,
      payload: {
        name: 'Rosa Navarro Gil',
        email: 'Rosa.Gil@incidapp.test',
        role: 'USER',
        departmentIds: [await departmentId('TEC')],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(UserAdmin.parse(response.json())).toMatchObject({
      id: created.id,
      name: 'Rosa Navarro Gil',
      email: 'rosa.gil@incidapp.test',
      role: 'USER',
      active: true,
      departments: [{ code: 'TEC' }],
    });
  });

  it('CA-02.8: la contraseña y el estado activo no se cambian por esta vía', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);
    const hashBefore = (await userRow(created.id))?.passwordHash;

    const response = await call('PATCH', `/api/users/${created.id}`, {
      token,
      payload: { name: 'Rosa N.', password: 'Otra-Clave-2026', active: false },
    });

    expect(response.statusCode).toBe(200);
    const row = await userRow(created.id);
    expect(row).toMatchObject({ name: 'Rosa N.', active: true, passwordHash: hashBefore });
  });

  it('CA-02.8: un email ya registrado responde 409', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);

    const response = await call('PATCH', `/api/users/${created.id}`, {
      token,
      payload: { email: MANAGER.email },
    });

    expect(response.statusCode).toBe(409);
    expect(errorOf(response)).toEqual({ code: 'CONFLICT', message: EMAIL_TAKEN });
  });

  it.each([
    ['un cuerpo vacío', {}, '', 'Indica al menos un campo que cambiar.'],
    ['un nombre vacío', { name: '' }, 'name', 'El nombre es obligatorio.'],
    [
      'sin departamentos',
      { departmentIds: [] },
      'departmentIds',
      'Selecciona al menos un departamento.',
    ],
  ])('CA-02.8: %s responde 400 VALIDATION', async (_case, payload, path, message) => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);

    const response = await call('PATCH', `/api/users/${created.id}`, { token, payload });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response).details).toContainEqual({ path, message });
  });

  it('CA-02.8: un id inexistente responde 404', async () => {
    const token = await loginAs(ADMIN.email);

    const response = await call('PATCH', `/api/users/${MISSING_ID}`, {
      token,
      payload: { name: 'Nadie' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('CA-02.4: si el Admin cambia el rol de un usuario, su siguiente /me ya trae el rol y las acciones nuevas', async () => {
    const adminToken = await loginAs(ADMIN.email);
    const created = await createUser(adminToken, { role: 'USER' });
    const userToken = await loginAs(created.email, NEW_PASSWORD);

    await call('PATCH', `/api/users/${created.id}`, {
      token: adminToken,
      payload: { role: 'DIRECTOR' },
    });

    const me = await call('GET', '/api/auth/me', { token: userToken });
    expect(me.statusCode).toBe(200);
    expect(CurrentUser.parse(me.json())).toMatchObject({
      role: 'DIRECTOR',
      allowedActions: ['viewDashboard'],
    });
  });
});

// --- CA-02.9 ------------------------------------------------------------------------------------

describe('CA-02.9: desactivar y reactivar', () => {
  it('CA-02.9: desactivar responde 200 con active: false, su siguiente petición da 401 y su login también', async () => {
    const adminToken = await loginAs(ADMIN.email);
    const created = await createUser(adminToken);
    const userToken = await loginAs(created.email, NEW_PASSWORD);
    await loginAs(created.email, NEW_PASSWORD);

    const response = await call('POST', `/api/users/${created.id}/deactivate`, {
      token: adminToken,
    });

    expect(response.statusCode).toBe(200);
    expect(UserAdmin.parse(response.json())).toMatchObject({ id: created.id, active: false });
    expect(await sessionCount(created.id)).toBe(0);
    expect((await call('GET', '/api/auth/me', { token: userToken })).statusCode).toBe(401);
    const relogin = await login(created.email, NEW_PASSWORD);
    expect(relogin.statusCode).toBe(401);
    expect(errorOf(relogin).message).toBe('Email o contraseña incorrectos.');
  });

  it('CA-02.9: reactivar responde 200 con active: true y puede volver a iniciar sesión', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);
    await call('POST', `/api/users/${created.id}/deactivate`, { token });

    const response = await call('POST', `/api/users/${created.id}/activate`, { token });

    expect(response.statusCode).toBe(200);
    expect(UserAdmin.parse(response.json()).active).toBe(true);
    expect((await login(created.email, NEW_PASSWORD)).statusCode).toBe(200);
  });

  it.each([
    ['desactivar a un desactivado', 'deactivate', true],
    ['activar a un activo', 'activate', false],
  ])(
    'CA-02.9: %s responde 200 sin cambios y sin auditoría',
    async (_case, action, deactivateFirst) => {
      const token = await loginAs(ADMIN.email);
      const created = await createUser(token);
      if (deactivateFirst) await call('POST', `/api/users/${created.id}/deactivate`, { token });
      const rowsBefore = await userAuditRows();

      const response = await call('POST', `/api/users/${created.id}/${action}`, { token });

      expect(response.statusCode).toBe(200);
      expect(UserAdmin.parse(response.json()).active).toBe(!deactivateFirst);
      expect(await userAuditRows()).toEqual(rowsBefore);
    },
  );

  it('CA-02.9: los usuarios nunca se borran: DELETE /api/users/:id no existe (404)', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);

    const response = await call('DELETE', `/api/users/${created.id}`, { token });

    expect(response.statusCode).toBe(404);
    expect(await userRow(created.id)).toBeDefined();
  });
});

// --- CA-02.10 -----------------------------------------------------------------------------------

describe('CA-02.10: el Admin no se bloquea a sí mismo', () => {
  /** Admin que no es demo (al demo le aplica antes la protección de CA-02.11). */
  async function ownAdmin() {
    const demoToken = await loginAs(ADMIN.email);
    const admin = await createUser(demoToken, {
      email: 'marta.lopez@incidapp.test',
      name: 'Marta López',
      role: 'ADMIN',
      departmentIds: [await departmentId('ADM')],
    });
    return { admin, token: await loginAs(admin.email, NEW_PASSWORD) };
  }

  it.each([
    ['desactivarse', 'POST', 'deactivate', undefined],
    ['quitarse el rol de Admin', 'PATCH', '', { role: 'MANAGER' }],
  ] as const)(
    'CA-02.10: %s responde 409 con el mensaje en español y no cambia nada',
    async (_case, method, action, payload) => {
      const { admin, token } = await ownAdmin();

      const response = await call(
        method,
        `/api/users/${admin.id}${action ? `/${action}` : ''}`,
        payload ? { token, payload } : { token },
      );

      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toEqual({ code: 'CONFLICT', message: SELF_MESSAGE });
      expect(await userRow(admin.id)).toMatchObject({ active: true, role: 'ADMIN' });
    },
  );

  it('CA-02.10: sus propias allowedActions no incluyen desactivar ni cambiar el rol', async () => {
    const { admin, token } = await ownAdmin();

    const response = await call('GET', `/api/users/${admin.id}`, { token });

    expect(UserAdmin.parse(response.json()).allowedActions).toEqual([
      'rename',
      'changeEmail',
      'changeDepartments',
      'resetPassword',
    ]);
  });
});

// --- CA-02.11 -----------------------------------------------------------------------------------

describe('CA-02.11: usuarios demo protegidos', () => {
  it.each([
    ['desactivarlo', 'POST', 'deactivate', undefined],
    ['cambiar su email', 'PATCH', '', { email: 'otro@incidapp.test' }],
    ['cambiar su rol', 'PATCH', '', { role: 'MANAGER' }],
    ['cambiar sus departamentos', 'PATCH', '', { departmentIds: 'CAL' }],
    ['restablecer su contraseña', 'POST', 'password', { password: NEW_PASSWORD }],
  ] as const)(
    'CA-02.11: %s responde 409 con el mensaje en español y no cambia nada',
    async (_case, method, action, payload) => {
      const token = await loginAs(ADMIN.email);
      const id = await userIdOf(USER.email);
      const before = await userRow(id);
      const body =
        payload && 'departmentIds' in payload
          ? { departmentIds: [await departmentId(payload.departmentIds)] }
          : payload;

      const response = await call(
        method,
        `/api/users/${id}${action ? `/${action}` : ''}`,
        body ? { token, payload: body } : { token },
      );

      expect(response.statusCode).toBe(409);
      expect(errorOf(response)).toEqual({ code: 'CONFLICT', message: DEMO_MESSAGE });
      expect(await userRow(id)).toEqual(before);
      expect((await login(USER.email)).statusCode).toBe(200);
    },
  );

  it('CA-02.11: su nombre sí se puede cambiar, y sus allowedActions solo incluyen rename', async () => {
    const token = await loginAs(ADMIN.email);
    const id = await userIdOf(USER.email);

    const response = await call('PATCH', `/api/users/${id}`, {
      token,
      payload: { name: 'Pablo Moreno Gil' },
    });

    expect(response.statusCode).toBe(200);
    expect(UserAdmin.parse(response.json())).toMatchObject({
      name: 'Pablo Moreno Gil',
      allowedActions: ['rename'],
    });
  });
});

// --- CA-02.12 -----------------------------------------------------------------------------------

describe('CA-02.12: restablecer la contraseña', () => {
  it('CA-02.12: responde 204, guarda el hash argon2id y cierra todas sus sesiones', async () => {
    const adminToken = await loginAs(ADMIN.email);
    const created = await createUser(adminToken);
    const userToken = await loginAs(created.email, NEW_PASSWORD);
    const password = 'Restablecida-2026';

    const response = await call('POST', `/api/users/${created.id}/password`, {
      token: adminToken,
      payload: { password },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    const row = await userRow(created.id);
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await sessionCount(created.id)).toBe(0);
    expect((await call('GET', '/api/auth/me', { token: userToken })).statusCode).toBe(401);
    expect((await login(created.email, NEW_PASSWORD)).statusCode).toBe(401);
    expect((await login(created.email, password)).statusCode).toBe(200);
  });

  it('CA-02.12: la contraseña no aparece en la respuesta, en los logs ni en la auditoría', async () => {
    const adminToken = await loginAs(ADMIN.email);
    const created = await createUser(adminToken);
    const password = 'Secreto-Que-No-Se-Ve';

    const response = await call('POST', `/api/users/${created.id}/password`, {
      token: adminToken,
      payload: { password },
    });

    expect(response.statusCode).toBe(204);
    expect(logLines.length).toBeGreaterThan(0);
    expect(logLines.join('\n')).not.toContain(password);
    expect(JSON.stringify(await auditRows())).not.toContain(password);
  });

  it('CA-02.12: una contraseña de menos de 8 caracteres responde 400', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);

    const response = await call('POST', `/api/users/${created.id}/password`, {
      token,
      payload: { password: 'corta' },
    });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response).details).toContainEqual({
      path: 'password',
      message: 'La contraseña debe tener al menos 8 caracteres.',
    });
  });
});

// --- CA-02.13 -----------------------------------------------------------------------------------

describe('CA-02.13: auditoría de los cambios de usuarios', () => {
  it('CA-02.13: cada cambio inserta su fila con el Admin, el usuario, la IP y solo lo que cambia', async () => {
    const token = await loginAs(ADMIN.email);
    const adminId = await userIdOf(ADMIN.email);
    const created = await createUser(token);
    await call('PATCH', `/api/users/${created.id}`, {
      token,
      payload: {
        name: created.name,
        role: 'USER',
        departmentIds: [await departmentId('TEC'), await departmentId('LOG')],
      },
    });
    await call('POST', `/api/users/${created.id}/deactivate`, { token });
    await call('POST', `/api/users/${created.id}/activate`, { token });
    await call('POST', `/api/users/${created.id}/password`, {
      token,
      payload: { password: 'Restablecida-2026' },
    });

    const rows = await userAuditRows();
    const common = {
      actorId: adminId,
      entity: 'user',
      entityId: created.id,
      ip: IP,
      createdAt: T0,
    };
    expect(rows).toEqual([
      expect.objectContaining({
        ...common,
        action: 'USER_CREATED',
        before: null,
        after: {
          email: 'rosa.navarro@incidapp.test',
          name: 'Rosa Navarro',
          role: 'MANAGER',
          departments: ['CAL', 'LOG'],
          active: true,
        },
      }),
      expect.objectContaining({
        ...common,
        action: 'USER_UPDATED',
        before: { role: 'MANAGER', departments: ['CAL', 'LOG'] },
        after: { role: 'USER', departments: ['LOG', 'TEC'] },
      }),
      expect.objectContaining({
        ...common,
        action: 'USER_DEACTIVATED',
        before: { active: true },
        after: { active: false },
      }),
      expect.objectContaining({
        ...common,
        action: 'USER_ACTIVATED',
        before: { active: false },
        after: { active: true },
      }),
      expect.objectContaining({
        ...common,
        action: 'USER_PASSWORD_RESET',
        before: null,
        after: null,
      }),
    ]);
    // Ni la contraseña ni su *hash* en ningún dato guardado (la acción sí se llama "…PASSWORD…").
    const data = JSON.stringify(rows.map(({ before, after }) => ({ before, after })));
    expect(data).not.toMatch(/argon2|Clave-Nueva|Restablecida|password/i);
  });

  it('CA-02.13: una edición sin cambios no inserta ninguna fila', async () => {
    const token = await loginAs(ADMIN.email);
    const created = await createUser(token);

    const response = await call('PATCH', `/api/users/${created.id}`, {
      token,
      payload: { name: created.name, email: created.email, role: created.role },
    });

    expect(response.statusCode).toBe(200);
    expect((await userAuditRows()).map((row) => row.action)).toEqual(['USER_CREATED']);
  });

  it('CA-02.13: un 409 no deja ni cambio ni fila de auditoría', async () => {
    const token = await loginAs(ADMIN.email);
    const id = await userIdOf(USER.email);

    await call('POST', `/api/users/${id}/deactivate`, { token });

    expect(
      await database.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'USER_DEACTIVATED'))),
    ).toEqual([]);
  });
});

// --- CA-02.14 -----------------------------------------------------------------------------------

describe('CA-02.14: catálogo de departamentos', () => {
  it.each(DEMO_USERS.map((user) => [user.role, user.email] as const))(
    'CA-02.14: %s recibe 200 con los nueve departamentos ordenados por nombre',
    async (_role, email) => {
      const token = await loginAs(email);

      const response = await call('GET', '/api/departments', { token });

      expect(response.statusCode).toBe(200);
      const list = z.array(DepartmentSummary).parse(response.json());
      expect(list).toHaveLength(9);
      expect(list.map((department) => department.name)).toEqual(
        DEPARTMENTS.map((department) => department.name).sort(),
      );
      expect(Object.keys(response.json<Record<string, unknown>[]>()[0]!).sort()).toEqual([
        'code',
        'id',
        'name',
      ]);
    },
  );

  it('CA-02.14: sin sesión responde 401', async () => {
    const response = await call('GET', '/api/departments');

    expect(response.statusCode).toBe(401);
  });
});
