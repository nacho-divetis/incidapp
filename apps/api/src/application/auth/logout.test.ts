import { beforeEach, describe, expect, it } from 'vitest';
import { makeLogout, type Logout } from './logout';
import { FakeSessionTokens, InMemorySessions } from './test-fakes';

const NOW = new Date('2026-11-23T10:00:00.000Z');
const USER_ID = '00000000-0000-4000-8000-000000000001';

let sessions: InMemorySessions;
let sessionTokens: FakeSessionTokens;
let logout: Logout;

beforeEach(async () => {
  sessions = new InMemorySessions();
  sessionTokens = new FakeSessionTokens();
  logout = makeLogout({ sessions, sessionTokens });
  for (const token of ['token-a', 'token-b']) {
    await sessions.create({
      id: sessionTokens.idFor(token),
      userId: USER_ID,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 1000),
    });
  }
});

describe('logout', () => {
  it('CA-01.7: borra la sesión del token y solo esa', async () => {
    await logout({ token: 'token-a' });

    expect([...sessions.sessions.keys()]).toEqual([sessionTokens.idFor('token-b')]);
  });

  it('CA-01.7: sin token no falla ni borra nada', async () => {
    await expect(logout({})).resolves.toBeUndefined();

    expect(sessions.sessions.size).toBe(2);
  });

  it('CA-01.7: con una sesión ya cerrada o desconocida no falla (idempotente)', async () => {
    await logout({ token: 'token-a' });

    await expect(logout({ token: 'token-a' })).resolves.toBeUndefined();
    await expect(logout({ token: 'token-desconocido' })).resolves.toBeUndefined();
    expect(sessions.sessions.size).toBe(1);
  });
});
