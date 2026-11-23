import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_TTL_MS } from '../../domain/auth/session';
import { UnauthorizedError } from '../errors';
import { makeResolveSession, type ResolveSession } from './resolve-session';
import {
  FakeSessionTokens,
  FixedClock,
  InMemorySessions,
  InMemoryUsers,
  type FakeUser,
} from './test-fakes';

const NOW = new Date('2026-11-23T10:00:00.000Z');

const user: FakeUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'responsable@incidapp.test',
  name: 'Carmen Vidal',
  role: 'MANAGER',
  active: true,
  passwordHash: 'fake:x',
  departments: [
    { id: '00000000-0000-4000-8000-0000000000d1', code: 'LOG', name: 'Logística y Almacén' },
  ],
};

let users: InMemoryUsers;
let sessions: InMemorySessions;
let sessionTokens: FakeSessionTokens;
let clock: FixedClock;
let resolveSession: ResolveSession;

async function openSession(token: string, userId = user.id): Promise<void> {
  await sessions.create({
    id: sessionTokens.idFor(token),
    userId,
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + SESSION_TTL_MS),
  });
}

beforeEach(() => {
  users = new InMemoryUsers([{ ...user }]);
  sessions = new InMemorySessions();
  sessionTokens = new FakeSessionTokens();
  clock = new FixedClock(NOW);
  resolveSession = makeResolveSession({ users, sessions, sessionTokens, clock });
});

describe('resolveSession', () => {
  it('CA-01.5: con una sesión válida devuelve el usuario actual con sus departamentos', async () => {
    await openSession('token-a');

    expect(await resolveSession({ token: 'token-a' })).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'MANAGER',
      departments: user.departments,
      allowedActions: ['createIncident'],
    });
  });

  it('CA-02.4: un cambio de rol se ve en la siguiente resolución, sin cerrar la sesión', async () => {
    await openSession('token-a');
    await resolveSession({ token: 'token-a' });

    users.users[0] = { ...user, role: 'ADMIN' };
    const current = await resolveSession({ token: 'token-a' });

    expect(current.role).toBe('ADMIN');
    expect(current.allowedActions).toEqual([
      'createIncident',
      'manageUsers',
      'viewAudit',
      'viewDashboard',
    ]);
    expect(sessions.sessions.size).toBe(1);
  });

  it('CA-01.5: sin token lanza UnauthorizedError', async () => {
    await expect(resolveSession({})).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('CA-01.5: con un token sin sesión lanza UnauthorizedError', async () => {
    await expect(resolveSession({ token: 'token-desconocido' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('CA-01.6: después de t + la duración lanza UnauthorizedError y borra la sesión caducada', async () => {
    await openSession('token-a');
    clock.advance(SESSION_TTL_MS + 1);

    await expect(resolveSession({ token: 'token-a' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sessions.sessions.size).toBe(0);
  });

  it('CA-01.6: justo antes de caducar la sesión sigue valiendo', async () => {
    await openSession('token-a');
    clock.advance(SESSION_TTL_MS - 1);

    await expect(resolveSession({ token: 'token-a' })).resolves.toMatchObject({ id: user.id });
  });

  it('CA-01.6: si el usuario pasa a inactivo, lanza UnauthorizedError y borra todas sus sesiones', async () => {
    const otherUserId = '00000000-0000-4000-8000-000000000009';
    users.users.push({ ...user, id: otherUserId, email: 'otro@incidapp.test' });
    await openSession('token-a');
    await openSession('token-b');
    await openSession('token-otro', otherUserId);
    users.users[0]!.active = false;

    await expect(resolveSession({ token: 'token-a' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect([...sessions.sessions.keys()]).toEqual([sessionTokens.idFor('token-otro')]);
  });

  it('CA-01.5: si el usuario de la sesión ya no existe, lanza UnauthorizedError', async () => {
    await openSession('token-a', '00000000-0000-4000-8000-00000000dead');

    await expect(resolveSession({ token: 'token-a' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sessions.sessions.size).toBe(0);
  });
});
