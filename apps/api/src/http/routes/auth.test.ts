// Tests de punta a punta de `/api/auth` con `fastify.inject`: casos de uso, repositorios Drizzle
// sobre PGlite en memoria, argon2id real y reloj fijo (CA-01.1 a CA-01.11).
import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import {
  CurrentUser,
  DEMO_PASSWORD,
  DEMO_USERS,
  ErrorResponse,
  PASSWORD_MAX_LENGTH,
} from '@incidapp/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeLogin } from '../../application/auth/login';
import { makeLogout } from '../../application/auth/logout';
import { makeResolveSession } from '../../application/auth/resolve-session';
import { FixedClock } from '../../application/auth/test-fakes';
import type { GetHealth } from '../../application/health/get-health';
import type { PasswordHasher } from '../../application/ports/password-hasher';
import { SESSION_TTL_MS } from '../../domain/auth/session';
import { createArgon2PasswordHasher } from '../../infrastructure/auth/argon2-password-hasher';
import { createSessionTokens } from '../../infrastructure/auth/session-tokens';
import type { DatabaseHandle } from '../../infrastructure/db/client';
import { createDrizzleAuditLogWriter } from '../../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleSessionRepository } from '../../infrastructure/db/repositories/session-repository';
import { createDrizzleUserRepository } from '../../infrastructure/db/repositories/user-repository';
import { auditLog, sessions, users } from '../../infrastructure/db/schema';
import { seedDatabase } from '../../infrastructure/db/seed';
import { createTestDatabase } from '../../infrastructure/db/test-database';
import { buildApp } from '../app';
import { CSRF_HEADER_MISSING_MESSAGE } from '../csrf';
import { LOGIN_RATE_LIMIT_MESSAGE } from './auth';

const T0 = new Date('2026-11-23T10:00:00.000Z');
const INVALID_CREDENTIALS: ErrorResponse = {
  error: { code: 'UNAUTHORIZED', message: 'Email o contraseña incorrectos.' },
};
const ADMIN = DEMO_USERS.find((user) => user.role === 'ADMIN')!;
const USER = DEMO_USERS.find((user) => user.role === 'USER')!;
const CSRF = { 'x-requested-with': 'fetch' };

const getHealth: GetHealth = async () => ({ status: 'ok', db: 'ok', version: '0.1.0' });
const argon2 = createArgon2PasswordHasher();

let database: DatabaseHandle;
let app: FastifyInstance | undefined;

/** *Hasher* real que cuenta las llamadas (CA-01.3: un 400 no llega a calcular ningún *hash*). */
function countingHasher(inner: PasswordHasher) {
  const calls = { hash: 0, verify: 0 };
  const hasher: PasswordHasher = {
    hash: (password) => {
      calls.hash += 1;
      return inner.hash(password);
    },
    verify: (hash, password) => {
      calls.verify += 1;
      return inner.verify(hash, password);
    },
  };
  return { hasher, calls };
}

interface SetupOptions {
  enforceHttps?: boolean;
  trustProxyHops?: number;
  loginRateLimit?: { max: number; timeWindowMs: number };
  logStream?: Writable;
}

/** Monta la app como el composition root, con el reloj fijo en T0. */
async function setup(options: SetupOptions = {}) {
  const clock = new FixedClock(T0);
  const { hasher, calls } = countingHasher(argon2);
  const deps = {
    users: createDrizzleUserRepository(database.db),
    sessions: createDrizzleSessionRepository(database.db),
    auditLog: createDrizzleAuditLogWriter(database.db),
    passwordHasher: hasher,
    sessionTokens: createSessionTokens(),
    clock,
  };
  app = await buildApp({
    getHealth,
    auth: {
      login: makeLogin(deps),
      logout: makeLogout(deps),
      resolveSession: makeResolveSession(deps),
      loginRateLimit: options.loginRateLimit ?? { max: 1000, timeWindowMs: 60_000 },
    },
    enforceHttps: options.enforceHttps ?? false,
    trustProxyHops: options.trustProxyHops ?? 0,
    logger: options.logStream ? { level: 'trace', stream: options.logStream } : false,
  });
  // El *hash* ficticio de `makeLogin` se calcula al construirlo: se descuenta.
  calls.hash = 0;
  return { app, clock, calls };
}

type Extra = Pick<InjectOptions, 'headers' | 'cookies' | 'remoteAddress'>;

function postLogin(
  target: FastifyInstance,
  payload: unknown,
  extra: Extra = {},
): Promise<LightMyRequestResponse> {
  return target.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: payload as InjectOptions['payload'],
    ...extra,
    headers: { ...CSRF, ...extra.headers },
  });
}

const getMe = (target: FastifyInstance, token?: string) =>
  target.inject({
    method: 'GET',
    url: '/api/auth/me',
    cookies: token === undefined ? {} : { incidapp_session: token },
  });

const postLogout = (target: FastifyInstance, token?: string, headers = CSRF) =>
  target.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers,
    cookies: token === undefined ? {} : { incidapp_session: token },
  });

const sessionCookie = (response: LightMyRequestResponse) =>
  response.cookies.find((cookie) => cookie.name === 'incidapp_session');

/** Inicia sesión con un usuario demo y devuelve el *token* de la cookie. */
async function loginAs(target: FastifyInstance, email: string, extra: Extra = {}) {
  const response = await postLogin(target, { email, password: DEMO_PASSWORD }, extra);
  expect(response.statusCode).toBe(200);
  const token = sessionCookie(response)?.value;
  if (!token) throw new Error('El login no ha fijado la cookie de sesión.');
  return token;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function userIdOf(email: string): Promise<string> {
  const [row] = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  return row!.id;
}

const sessionsOf = async (email: string) =>
  database.db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, await userIdOf(email)));

beforeAll(async () => {
  database = await createTestDatabase();
  await seedDatabase(database.db, { passwordHasher: argon2 });
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  // Cada test parte de una BD sin sesiones ni auditoría y con los usuarios demo activos.
  await database.db.delete(sessions);
  await database.db.delete(auditLog);
  await database.db.update(users).set({ active: true });
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('POST /api/auth/login', () => {
  it('CA-01.1: con credenciales correctas responde 200 con CurrentUser y sin datos internos', async () => {
    const { app } = await setup();

    const response = await postLogin(app, { email: ADMIN.email, password: DEMO_PASSWORD });

    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual([
      'allowedActions',
      'departments',
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(CurrentUser.parse(body)).toEqual({
      id: await userIdOf(ADMIN.email),
      email: ADMIN.email,
      name: ADMIN.name,
      role: 'ADMIN',
      departments: [{ id: expect.any(String), code: 'ADM', name: 'Administración y Finanzas' }],
      allowedActions: ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard'],
    });
    expect(response.body).not.toMatch(/argon2|password|hash|active/i);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('CA-01.1: fija la cookie incidapp_session httpOnly, SameSite=Lax y Path=/, sin Secure por HTTP', async () => {
    const { app } = await setup({ enforceHttps: false });

    const response = await postLogin(app, { email: ADMIN.email, password: DEMO_PASSWORD });

    expect(sessionCookie(response)).toEqual({
      name: 'incidapp_session',
      value: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
  });

  it('CA-01.1: con HTTPS (producción) la cookie lleva Secure', async () => {
    const { app } = await setup({ enforceHttps: true });

    const response = await postLogin(app, { email: ADMIN.email, password: DEMO_PASSWORD });

    expect(sessionCookie(response)?.secure).toBe(true);
  });

  it('CA-01.1: crea una fila en sessions con la caducidad, guardada con el SHA-256 del token', async () => {
    const { app } = await setup();

    const token = await loginAs(app, ADMIN.email);

    expect(await sessionsOf(ADMIN.email)).toEqual([
      {
        id: sha256(token),
        userId: await userIdOf(ADMIN.email),
        expiresAt: new Date(T0.getTime() + SESSION_TTL_MS),
        createdAt: T0,
      },
    ]);
  });

  it('CA-01.1: el email se compara sin distinguir mayúsculas ni espacios al principio o al final', async () => {
    const { app } = await setup();

    const response = await postLogin(app, {
      email: `  ${ADMIN.email.toUpperCase()}  `,
      password: DEMO_PASSWORD,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<CurrentUser>().email).toBe(ADMIN.email);
  });

  it.each(DEMO_USERS.map((user) => [user.role, user.email] as const))(
    'CA-01.12: se puede iniciar sesión con el usuario demo %s (%s)',
    async (role, email) => {
      const { app } = await setup();

      const response = await postLogin(app, { email, password: DEMO_PASSWORD });

      expect(response.statusCode).toBe(200);
      expect(response.json<CurrentUser>().role).toBe(role);
    },
  );

  it.each([
    ['un email que no existe', 'nadie@incidapp.test', DEMO_PASSWORD, false],
    ['una contraseña incorrecta', ADMIN.email, 'Incorrecta2026!', false],
    ['un usuario desactivado', USER.email, DEMO_PASSWORD, true],
  ])(
    'CA-01.2: con %s responde 401 con el mensaje único, sin cookie ni sesión',
    async (_case, email, password, deactivate) => {
      if (deactivate)
        await database.db.update(users).set({ active: false }).where(eq(users.email, email));
      const { app } = await setup();

      const response = await postLogin(app, { email, password });

      expect(response.statusCode).toBe(401);
      expect(ErrorResponse.parse(response.json())).toEqual(INVALID_CREDENTIALS);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await database.db.select().from(sessions)).toEqual([]);
    },
  );

  it.each([
    ['sin cuerpo', undefined, '', expect.stringMatching(/^Entrada inválida: se esperaba objeto/)],
    ['sin email', { password: DEMO_PASSWORD }, 'email', 'El email es obligatorio.'],
    [
      'con un email mal formado',
      { email: 'no-es-un-email', password: DEMO_PASSWORD },
      'email',
      'El email no es válido.',
    ],
    [
      'con la contraseña vacía',
      { email: ADMIN.email, password: '' },
      'password',
      'La contraseña es obligatoria.',
    ],
    [
      'con una contraseña de más de 200 caracteres',
      { email: ADMIN.email, password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1) },
      'password',
      `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres.`,
    ],
  ])(
    'CA-01.3: %s responde 400 VALIDATION con details en español y sin calcular ningún hash',
    async (_case, payload, path, message) => {
      const { app, calls } = await setup();

      const response = await postLogin(app, payload);

      expect(response.statusCode).toBe(400);
      const body = ErrorResponse.parse(response.json());
      expect(body.error.code).toBe('VALIDATION');
      expect(body.error.details).toContainEqual({ path, message });
      expect(calls).toEqual({ hash: 0, verify: 0 });
      expect(await database.db.select().from(auditLog)).toEqual([]);
    },
  );

  it('CA-01.3: los campos que no son email ni password se ignoran', async () => {
    const { app } = await setup();

    const response = await postLogin(app, {
      email: USER.email,
      password: DEMO_PASSWORD,
      role: 'ADMIN',
      id: '00000000-0000-4000-8000-000000000000',
      active: false,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<CurrentUser>();
    expect(body.role).toBe('USER');
    expect(body.id).toBe(await userIdOf(USER.email));
  });

  it('CA-01.4: un login con una cookie válida borra la sesión anterior y crea otra distinta', async () => {
    const { app } = await setup();
    const previous = await loginAs(app, ADMIN.email);

    const current = await loginAs(app, ADMIN.email, { cookies: { incidapp_session: previous } });

    expect(current).not.toBe(previous);
    expect((await sessionsOf(ADMIN.email)).map((session) => session.id)).toEqual([sha256(current)]);
    expect((await getMe(app, previous)).statusCode).toBe(401);
    expect((await getMe(app, current)).statusCode).toBe(200);
  });

  it('CA-01.9: un login correcto inserta LOGIN_SUCCEEDED con el actor, la entidad, su id y la IP', async () => {
    const { app } = await setup();

    await loginAs(app, ADMIN.email, { remoteAddress: '203.0.113.10' });

    const adminId = await userIdOf(ADMIN.email);
    expect(await database.db.select().from(auditLog)).toEqual([
      {
        id: expect.any(String),
        actorId: adminId,
        action: 'LOGIN_SUCCEEDED',
        entity: 'user',
        entityId: adminId,
        before: null,
        after: null,
        ip: '203.0.113.10',
        createdAt: T0,
      },
    ]);
  });

  it('CA-01.9: un login fallido inserta LOGIN_FAILED con la IP y el email, sin actor si no existe y nunca con la contraseña', async () => {
    const { app } = await setup();
    const wrongPassword = 'Secreta-Incorrecta-42';

    await postLogin(
      app,
      { email: 'nadie@incidapp.test', password: wrongPassword },
      { remoteAddress: '203.0.113.11' },
    );
    await postLogin(
      app,
      { email: ADMIN.email, password: wrongPassword },
      { remoteAddress: '203.0.113.11' },
    );

    const rows = await database.db.select().from(auditLog);
    expect(rows).toEqual([
      expect.objectContaining({
        actorId: null,
        action: 'LOGIN_FAILED',
        entity: 'user',
        after: { email: 'nadie@incidapp.test', reason: 'UNKNOWN_EMAIL' },
        ip: '203.0.113.11',
      }),
      expect.objectContaining({
        actorId: await userIdOf(ADMIN.email),
        action: 'LOGIN_FAILED',
        after: { email: ADMIN.email, reason: 'BAD_PASSWORD' },
        ip: '203.0.113.11',
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain(wrongPassword);
  });
});

describe('GET /api/auth/me', () => {
  it('CA-01.5: con una sesión válida responde 200 con CurrentUser y sus departamentos', async () => {
    const { app } = await setup();
    const token = await loginAs(app, USER.email);

    const response = await getMe(app, token);

    expect(response.statusCode).toBe(200);
    expect(CurrentUser.parse(response.json())).toEqual({
      id: await userIdOf(USER.email),
      email: USER.email,
      name: USER.name,
      role: 'USER',
      departments: [{ id: expect.any(String), code: 'LOG', name: 'Logística y Almacén' }],
      allowedActions: ['createIncident'],
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['ADMIN', ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard']],
    ['DIRECTOR', ['viewDashboard']],
    ['MANAGER', ['createIncident']],
    ['USER', ['createIncident']],
  ] as const)(
    'CA-02.4: login y me del usuario demo %s incluyen sus acciones globales %j',
    async (role, expected) => {
      const { app } = await setup();
      const demo = DEMO_USERS.find((user) => user.role === role)!;

      const login = await postLogin(app, { email: demo.email, password: DEMO_PASSWORD });
      const token = sessionCookie(login)?.value;
      const me = await getMe(app, token);

      expect(CurrentUser.parse(login.json()).allowedActions).toEqual(expected);
      expect(CurrentUser.parse(me.json()).allowedActions).toEqual(expected);
    },
  );

  it('CA-02.4: si cambia el rol en la BD, el siguiente me devuelve el rol y las acciones nuevas sin cerrar la sesión', async () => {
    const { app } = await setup();
    const token = await loginAs(app, USER.email);
    expect(CurrentUser.parse((await getMe(app, token)).json()).allowedActions).toEqual([
      'createIncident',
    ]);

    try {
      await database.db.update(users).set({ role: 'DIRECTOR' }).where(eq(users.email, USER.email));

      const response = await getMe(app, token);

      expect(response.statusCode).toBe(200);
      const current = CurrentUser.parse(response.json());
      expect(current.role).toBe('DIRECTOR');
      expect(current.allowedActions).toEqual(['viewDashboard']);
      expect(await sessionsOf(USER.email)).toHaveLength(1);
    } finally {
      await database.db.update(users).set({ role: USER.role }).where(eq(users.email, USER.email));
    }
  });

  it.each([
    ['sin cookie', undefined],
    ['con un identificador que no existe', 'token-que-no-existe'],
  ])('CA-01.5: %s responde 401 UNAUTHORIZED', async (_case, token) => {
    const { app } = await setup();

    const response = await getMe(app, token);

    expect(response.statusCode).toBe(401);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('CA-01.5 y CA-01.6: una sesión usada después de t + la duración responde 401 y se borra', async () => {
    const { app, clock } = await setup();
    const token = await loginAs(app, ADMIN.email);

    clock.advance(SESSION_TTL_MS - 1);
    expect((await getMe(app, token)).statusCode).toBe(200);
    clock.advance(1);
    const response = await getMe(app, token);

    expect(response.statusCode).toBe(401);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('UNAUTHORIZED');
    expect(await sessionsOf(ADMIN.email)).toEqual([]);
  });

  it('CA-01.6: si el usuario pasa a active = false, su siguiente petición responde 401 y se borran todas sus sesiones', async () => {
    const { app } = await setup();
    const token = await loginAs(app, USER.email);
    await loginAs(app, USER.email);
    expect(await sessionsOf(USER.email)).toHaveLength(2);

    await database.db.update(users).set({ active: false }).where(eq(users.email, USER.email));
    const response = await getMe(app, token);

    expect(response.statusCode).toBe(401);
    expect(await sessionsOf(USER.email)).toEqual([]);
  });
});

describe('POST /api/auth/logout', () => {
  it('CA-01.7: con una sesión válida responde 204, borra la sesión y la cookie', async () => {
    const { app } = await setup();
    const token = await loginAs(app, ADMIN.email);

    const response = await postLogout(app, token);

    expect(response.statusCode).toBe(204);
    expect(await sessionsOf(ADMIN.email)).toEqual([]);
    const cookie = sessionCookie(response);
    expect(cookie).toMatchObject({ value: '', httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie?.maxAge === 0 || (cookie?.expires?.getTime() ?? Infinity) <= Date.now()).toBe(
      true,
    );
    expect((await getMe(app, token)).statusCode).toBe(401);
  });

  it('CA-01.7: sin sesión o con una ya cerrada también responde 204 (idempotente)', async () => {
    const { app } = await setup();
    const token = await loginAs(app, ADMIN.email);

    expect((await postLogout(app)).statusCode).toBe(204);
    expect((await postLogout(app, token)).statusCode).toBe(204);
    expect((await postLogout(app, token)).statusCode).toBe(204);
    expect((await postLogout(app, 'token-que-no-existe')).statusCode).toBe(204);
  });
});

describe('límite de intentos de login', () => {
  const LIMIT = { max: 3, timeWindowMs: 60_000 };

  it('CA-01.8: al superar el máximo de intentos (aunque sean correctos) responde 429 con Retry-After', async () => {
    const { app } = await setup({ loginRateLimit: LIMIT });
    for (let attempt = 0; attempt < LIMIT.max; attempt += 1) await loginAs(app, ADMIN.email);

    const response = await postLogin(app, { email: ADMIN.email, password: DEMO_PASSWORD });

    expect(response.statusCode).toBe(429);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: { code: 'TOO_MANY_REQUESTS', message: LOGIN_RATE_LIMIT_MESSAGE },
    });
    expect(LOGIN_RATE_LIMIT_MESSAGE).toMatch(/inicio de sesión/);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(sessionCookie(response)).toBeUndefined();
  });

  it('CA-01.8: el límite solo se aplica al login: me y logout no se ven afectados', async () => {
    const { app } = await setup({ loginRateLimit: LIMIT });
    const token = await loginAs(app, ADMIN.email);
    for (let attempt = 1; attempt < LIMIT.max; attempt += 1) await loginAs(app, USER.email);
    expect((await postLogin(app, { email: USER.email, password: DEMO_PASSWORD })).statusCode).toBe(
      429,
    );

    for (let attempt = 0; attempt < LIMIT.max + 2; attempt += 1) {
      expect((await getMe(app, token)).statusCode).toBe(200);
      expect((await postLogout(app, 'token-que-no-existe')).statusCode).toBe(204);
    }
    expect((await postLogout(app, token)).statusCode).toBe(204);
  });

  it('CA-01.8: el límite es por IP de cliente', async () => {
    const { app } = await setup({ loginRateLimit: LIMIT });
    const first = { remoteAddress: '203.0.113.20' };
    for (let attempt = 0; attempt < LIMIT.max; attempt += 1) await loginAs(app, ADMIN.email, first);
    expect(
      (await postLogin(app, { email: ADMIN.email, password: DEMO_PASSWORD }, first)).statusCode,
    ).toBe(429);

    await loginAs(app, ADMIN.email, { remoteAddress: '203.0.113.21' });
  });

  it('CA-01.8: detrás del proxy (trustProxyHops = 1) usa la IP real de X-Forwarded-For y no la primera, que el cliente puede falsear', async () => {
    const { app } = await setup({ loginRateLimit: LIMIT, trustProxyHops: 1 });
    const viaProxy = (forwardedFor: string): Extra => ({
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': forwardedFor },
    });

    for (let attempt = 0; attempt < LIMIT.max; attempt += 1) {
      await loginAs(app, ADMIN.email, viaProxy('203.0.113.30'));
    }
    // Una IP inventada al principio de la cabecera no reinicia el contador del cliente real.
    const spoofed = await postLogin(
      app,
      { email: ADMIN.email, password: DEMO_PASSWORD },
      viaProxy('198.51.100.99, 203.0.113.30'),
    );
    expect(spoofed.statusCode).toBe(429);
    // Otro cliente detrás del mismo proxy tiene su propio contador.
    await loginAs(app, ADMIN.email, viaProxy('203.0.113.31'));

    const ips = (await database.db.select({ ip: auditLog.ip }).from(auditLog)).map((row) => row.ip);
    expect(new Set(ips)).toEqual(new Set(['203.0.113.30', '203.0.113.31']));
  });

  it('CA-01.8: con trustProxyHops = 2 toma la penúltima IP de X-Forwarded-For y no usa las que el cliente añade a la izquierda', async () => {
    const { app } = await setup({ loginRateLimit: LIMIT, trustProxyHops: 2 });
    // Cliente → proxy 1 (añade la IP del cliente) → proxy 2 (añade la del proxy 1, 10.0.0.2) → API.
    const viaTwoProxies = (forwardedFor: string): Extra => ({
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': forwardedFor },
    });

    for (let attempt = 0; attempt < LIMIT.max; attempt += 1) {
      await loginAs(app, ADMIN.email, viaTwoProxies('203.0.113.50, 10.0.0.2'));
    }
    const spoofed = await postLogin(
      app,
      { email: ADMIN.email, password: DEMO_PASSWORD },
      viaTwoProxies('198.51.100.99, 203.0.113.50, 10.0.0.2'),
    );
    expect(spoofed.statusCode).toBe(429);
    await loginAs(app, ADMIN.email, viaTwoProxies('198.51.100.98, 203.0.113.51, 10.0.0.2'));

    const ips = (await database.db.select({ ip: auditLog.ip }).from(auditLog)).map((row) => row.ip);
    expect(ips).toEqual(['203.0.113.50', '203.0.113.50', '203.0.113.50', '203.0.113.51']);
  });

  it('CA-01.8: con IPv6, las direcciones del mismo /64 comparten contador y las de otro /64 no', async () => {
    const { app } = await setup({ loginRateLimit: LIMIT });
    const from = (remoteAddress: string): Extra => ({ remoteAddress });

    await loginAs(app, ADMIN.email, from('2001:db8:1:2::1'));
    await loginAs(app, ADMIN.email, from('2001:db8:1:2::2'));
    await loginAs(app, ADMIN.email, from('2001:db8:1:2:aaaa:bbbb:cccc:dddd'));
    const rotated = await postLogin(
      app,
      { email: ADMIN.email, password: DEMO_PASSWORD },
      from('2001:db8:1:2::ffff'),
    );
    expect(rotated.statusCode).toBe(429);

    await loginAs(app, ADMIN.email, from('2001:db8:1:3::1'));
  });

  it('CA-01.8: sin proxy de confianza (trustProxyHops = 0) se ignora X-Forwarded-For', async () => {
    const { app } = await setup({ trustProxyHops: 0 });

    await loginAs(app, ADMIN.email, {
      remoteAddress: '203.0.113.40',
      headers: { 'x-forwarded-for': '198.51.100.1' },
    });

    const [row] = await database.db.select({ ip: auditLog.ip }).from(auditLog);
    expect(row?.ip).toBe('203.0.113.40');
  });
});

describe('cabecera anti-CSRF en /api/auth', () => {
  it('CA-01.10: login sin X-Requested-With responde 403 antes de validar el cuerpo', async () => {
    const { app, calls } = await setup();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'no-es-un-email', password: '' },
    });

    expect(response.statusCode).toBe(403);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: { code: 'FORBIDDEN', message: CSRF_HEADER_MISSING_MESSAGE },
    });
    expect(calls).toEqual({ hash: 0, verify: 0 });
  });

  it('CA-01.10: los login rechazados por falta de la cabecera no cuentan para el límite de intentos', async () => {
    const { app } = await setup({ loginRateLimit: { max: 2, timeWindowMs: 60_000 } });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: ADMIN.email, password: DEMO_PASSWORD },
      });
      expect(response.statusCode).toBe(403);
    }

    await loginAs(app, ADMIN.email);
    await loginAs(app, ADMIN.email);
  });

  it('CA-01.10: logout sin X-Requested-With responde 403 y no cierra la sesión', async () => {
    const { app } = await setup();
    const token = await loginAs(app, ADMIN.email);

    const response = await postLogout(app, token, {} as typeof CSRF);

    expect(response.statusCode).toBe(403);
    expect(await sessionsOf(ADMIN.email)).toHaveLength(1);
  });
});

describe('contraseñas protegidas', () => {
  it('CA-01.11: password_hash de los usuarios es argon2id, nunca la contraseña en claro', async () => {
    const rows = await database.db.select({ passwordHash: users.passwordHash }).from(users);

    expect(rows.length).toBeGreaterThan(0);
    for (const { passwordHash } of rows) {
      expect(passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(passwordHash).not.toContain(DEMO_PASSWORD);
    }
  });

  it('CA-01.11: la contraseña no aparece en el log, aunque se registre el cuerpo de la petición', async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const { app } = await setup({ logStream });
    // Una ruta que registrase el cuerpo por descuido: el `redact` del logger lo cubre.
    app.post('/api/eco', async (request) => {
      request.log.info({ body: request.body }, 'cuerpo recibido');
      request.log.info(request.body as object, 'cuerpo recibido en la raíz');
      return { ok: true };
    });
    const wrongPassword = 'Secreta-Incorrecta-42';

    await postLogin(app, { email: ADMIN.email, password: DEMO_PASSWORD });
    await postLogin(app, { email: ADMIN.email, password: wrongPassword });
    await app.inject({
      method: 'POST',
      url: '/api/eco',
      headers: CSRF,
      payload: { email: ADMIN.email, password: wrongPassword },
    });

    const output = lines.join('');
    expect(output).toContain('cuerpo recibido');
    expect(output).toContain(ADMIN.email);
    expect(output).not.toContain(DEMO_PASSWORD);
    expect(output).not.toContain(wrongPassword);
  });
});
