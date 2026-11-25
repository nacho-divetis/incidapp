import { CurrentUser, EMAIL_MAX_LENGTH } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_TTL_MS } from '../../domain/auth/session';
import { UnauthorizedError } from '../errors';
import { makeLogin, type Login } from './login';
import {
  FakePasswordHasher,
  FakeSessionTokens,
  FixedClock,
  InMemoryAuditLog,
  InMemorySessions,
  InMemoryUsers,
  type FakeUser,
} from './test-fakes';

const NOW = new Date('2026-11-23T10:00:00.000Z');
const IP = '203.0.113.7';
const PASSWORD = 'Secreta-123';
const INVALID_CREDENTIALS = 'Email o contraseña incorrectos.';

const activeUser: FakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'usuario@incidapp.test',
  name: 'Pablo Moreno',
  role: 'USER',
  active: true,
  passwordHash: `fake:${PASSWORD}`,
  departments: [
    { id: '00000000-0000-4000-8000-0000000000d1', code: 'LOG', name: 'Logística y Almacén' },
  ],
};

const inactiveUser: FakeUser = {
  ...activeUser,
  id: '00000000-0000-4000-8000-000000000002',
  email: 'baja@incidapp.test',
  name: 'Usuario de baja',
  active: false,
};

let users: InMemoryUsers;
let sessions: InMemorySessions;
let auditLog: InMemoryAuditLog;
let passwordHasher: FakePasswordHasher;
let sessionTokens: FakeSessionTokens;
let clock: FixedClock;
let login: Login;

beforeEach(() => {
  users = new InMemoryUsers([activeUser, inactiveUser]);
  sessions = new InMemorySessions();
  auditLog = new InMemoryAuditLog();
  passwordHasher = new FakePasswordHasher();
  sessionTokens = new FakeSessionTokens();
  clock = new FixedClock(NOW);
  login = makeLogin({ users, sessions, auditLog, passwordHasher, sessionTokens, clock });
});

/** Ejecuta `login` esperando que falle y devuelve el error. */
async function loginError(input: Parameters<Login>[0]): Promise<unknown> {
  try {
    await login(input);
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que el login fallara');
}

describe('login correcto', () => {
  it('CA-01.1: devuelve el usuario actual (sin datos internos), el token y la caducidad', async () => {
    const result = await login({ email: activeUser.email, password: PASSWORD, ip: IP });

    expect(result.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      name: activeUser.name,
      role: 'USER',
      departments: activeUser.departments,
      allowedActions: ['createIncident'],
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('active');
    expect(CurrentUser.parse(result.user)).toEqual(result.user);
    expect(result.token).toBe('token-1');
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + SESSION_TTL_MS));
  });

  it.each([
    ['ADMIN', ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard']],
    ['DIRECTOR', ['viewDashboard']],
    ['MANAGER', ['createIncident']],
    ['USER', ['createIncident']],
  ] as const)(
    'CA-02.4: el usuario actual de rol %s incluye sus acciones globales %j',
    async (role, expected) => {
      users.users[0] = { ...activeUser, role };

      const result = await login({ email: activeUser.email, password: PASSWORD, ip: IP });

      expect(result.user.allowedActions).toEqual(expected);
    },
  );

  it('CA-01.1: crea la sesión guardando el identificador derivado del token, no el token', async () => {
    const { token } = await login({ email: activeUser.email, password: PASSWORD, ip: IP });

    expect([...sessions.sessions.values()]).toEqual([
      {
        id: sessionTokens.idFor(token),
        userId: activeUser.id,
        expiresAt: new Date(NOW.getTime() + SESSION_TTL_MS),
        createdAt: NOW,
      },
    ]);
    expect(sessions.sessions.has(token)).toBe(false);
  });

  it('CA-01.1: compara el email sin distinguir mayúsculas ni espacios', async () => {
    const result = await login({ email: '  Usuario@IncidApp.TEST ', password: PASSWORD, ip: IP });

    expect(result.user.id).toBe(activeUser.id);
  });

  it('CA-01.9: audita LOGIN_SUCCEEDED con el usuario como actor, la entidad user y la IP', async () => {
    await login({ email: activeUser.email, password: PASSWORD, ip: IP });

    expect(auditLog.entries).toEqual([
      {
        actorId: activeUser.id,
        action: 'LOGIN_SUCCEEDED',
        entity: 'user',
        entityId: activeUser.id,
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });
});

describe('rotación y limpieza de sesiones', () => {
  it('CA-01.4: con una sesión válida previa, la borra y crea otra con un identificador distinto', async () => {
    const first = await login({ email: activeUser.email, password: PASSWORD, ip: IP });

    const second = await login({
      email: activeUser.email,
      password: PASSWORD,
      ip: IP,
      currentToken: first.token,
    });

    expect(second.token).not.toBe(first.token);
    expect(sessions.sessions.has(sessionTokens.idFor(first.token))).toBe(false);
    expect([...sessions.sessions.keys()]).toEqual([sessionTokens.idFor(second.token)]);
  });

  it('CA-01.4: un token previo que no existe no impide el login', async () => {
    const result = await login({
      email: activeUser.email,
      password: PASSWORD,
      ip: IP,
      currentToken: 'token-desconocido',
    });

    expect(sessions.sessions.has(sessionTokens.idFor(result.token))).toBe(true);
  });

  it('CA-01.6: borra las sesiones caducadas del usuario y conserva las vigentes', async () => {
    await sessions.create({
      id: 'caducada',
      userId: activeUser.id,
      createdAt: new Date(NOW.getTime() - SESSION_TTL_MS - 1000),
      expiresAt: new Date(NOW.getTime() - 1000),
    });
    await sessions.create({
      id: 'vigente',
      userId: activeUser.id,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 1000),
    });

    const result = await login({ email: activeUser.email, password: PASSWORD, ip: IP });

    expect([...sessions.sessions.keys()].sort()).toEqual(
      ['vigente', sessionTokens.idFor(result.token)].sort(),
    );
  });
});

describe('credenciales incorrectas', () => {
  const cases = [
    ['un email que no existe', 'nadie@incidapp.test', PASSWORD],
    ['una contraseña incorrecta', activeUser.email, 'otra-contraseña'],
    ['un usuario desactivado', inactiveUser.email, PASSWORD],
  ] as const;

  it.each(cases)(
    'CA-01.2: con %s lanza UnauthorizedError con el mensaje único',
    async (_case, email, password) => {
      const error = await loginError({ email, password, ip: IP });

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as Error).message).toBe(INVALID_CREDENTIALS);
    },
  );

  it.each(cases)('CA-01.2: con %s no crea ninguna sesión', async (_case, email, password) => {
    await loginError({ email, password, ip: IP });

    expect(sessions.sessions.size).toBe(0);
  });

  it('CA-01.2: con un email que no existe verifica igualmente contra un hash ficticio', async () => {
    await loginError({ email: 'nadie@incidapp.test', password: PASSWORD, ip: IP });

    expect(passwordHasher.verifications).toHaveLength(1);
    expect(passwordHasher.verifications[0]?.password).toBe(PASSWORD);
  });

  it('CA-01.2: un usuario desactivado no inicia sesión aunque tenga ya otras sesiones', async () => {
    await sessions.create({
      id: 'antigua',
      userId: inactiveUser.id,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 1000),
    });

    await loginError({ email: inactiveUser.email, password: PASSWORD, ip: IP });

    expect([...sessions.sessions.keys()]).toEqual(['antigua']);
  });

  it('CA-01.9: un email que no existe audita LOGIN_FAILED sin actor, con la IP y el email intentado', async () => {
    await loginError({ email: ' Nadie@IncidApp.test ', password: PASSWORD, ip: IP });

    expect(auditLog.entries).toEqual([
      {
        actorId: null,
        action: 'LOGIN_FAILED',
        entity: 'user',
        entityId: null,
        after: { email: 'nadie@incidapp.test', reason: 'UNKNOWN_EMAIL' },
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-01.9: una contraseña incorrecta audita LOGIN_FAILED con el usuario como actor', async () => {
    await loginError({ email: activeUser.email, password: 'otra-contraseña', ip: IP });

    expect(auditLog.entries).toEqual([
      {
        actorId: activeUser.id,
        action: 'LOGIN_FAILED',
        entity: 'user',
        entityId: activeUser.id,
        after: { email: activeUser.email, reason: 'BAD_PASSWORD' },
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-01.9: un usuario desactivado audita LOGIN_FAILED con el motivo INACTIVE', async () => {
    await loginError({ email: inactiveUser.email, password: PASSWORD, ip: IP });

    expect(auditLog.entries).toEqual([
      expect.objectContaining({
        actorId: inactiveUser.id,
        action: 'LOGIN_FAILED',
        after: { email: inactiveUser.email, reason: 'INACTIVE' },
      }),
    ]);
  });

  it.each(cases)(
    'CA-01.11: con %s la contraseña no aparece en la auditoría',
    async (_case, email, password) => {
      await loginError({ email, password, ip: IP });

      const serialized = JSON.stringify(auditLog.entries);
      expect(serialized).not.toContain(password);
      expect(serialized).not.toContain('fake:');
    },
  );

  it('CA-01.11: la contraseña de un login correcto tampoco aparece en la auditoría', async () => {
    await login({ email: activeUser.email, password: PASSWORD, ip: IP });

    expect(JSON.stringify(auditLog.entries)).not.toContain(PASSWORD);
  });

  it('CA-01.9: sin IP conocida se audita con ip null', async () => {
    await loginError({ email: 'nadie@incidapp.test', password: PASSWORD, ip: null });

    expect(auditLog.entries[0]?.ip).toBeNull();
  });
});

describe('hash ficticio', () => {
  it('CA-01.2: se precalcula al construir el caso de uso, antes de cualquier login', () => {
    expect(passwordHasher.hashed).toHaveLength(1);
  });

  it('CA-01.2: el primer login con un email inexistente no calcula ningún hash nuevo', async () => {
    await loginError({ email: 'nadie@incidapp.test', password: PASSWORD, ip: IP });
    await loginError({ email: 'otro@incidapp.test', password: PASSWORD, ip: IP });

    expect(passwordHasher.hashed).toHaveLength(1);
    const dummyHash = `fake:${passwordHasher.hashed[0]}`;
    expect(passwordHasher.verifications.map((v) => v.hash)).toEqual([dummyHash, dummyHash]);
  });

  it('CA-01.2: si el precálculo falla, no rompe la construcción y se reintenta en el login', async () => {
    const flakyHasher = new FakePasswordHasher();
    let calls = 0;
    const originalHash = flakyHasher.hash.bind(flakyHasher);
    flakyHasher.hash = async (password: string) => {
      calls += 1;
      if (calls === 1) throw new Error('fallo transitorio');
      return originalHash(password);
    };
    const flakyLogin = makeLogin({
      users,
      sessions,
      auditLog,
      passwordHasher: flakyHasher,
      sessionTokens,
      clock,
    });

    await expect(
      flakyLogin({ email: 'nadie@incidapp.test', password: PASSWORD, ip: IP }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(calls).toBe(2);
    expect(flakyHasher.verifications).toHaveLength(1);
  });
});

describe('límite del email auditado', () => {
  it('CA-01.9: un email enorme se audita recortado a EMAIL_MAX_LENGTH (254) caracteres', async () => {
    const hugeEmail = `${'a'.repeat(1_000_000)}@incidapp.test`;

    await loginError({ email: hugeEmail, password: PASSWORD, ip: IP });

    const audited = auditLog.entries[0]?.after?.email;
    expect(typeof audited).toBe('string');
    expect((audited as string).length).toBe(EMAIL_MAX_LENGTH);
    expect(hugeEmail.startsWith(audited as string)).toBe(true);
  });

  it('CA-01.9: un email dentro del límite se audita completo', async () => {
    const email = `${'a'.repeat(EMAIL_MAX_LENGTH - '@incidapp.test'.length)}@incidapp.test`;

    await loginError({ email, password: PASSWORD, ip: IP });

    expect(auditLog.entries[0]?.after?.email).toBe(email);
  });
});
