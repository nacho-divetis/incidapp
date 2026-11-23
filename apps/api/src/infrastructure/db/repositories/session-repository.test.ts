import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '../client';
import { sessions, users } from '../schema';
import { createTestDatabase } from '../test-database';
import { createDrizzleSessionRepository } from './session-repository';

const NOW = new Date('2026-11-23T10:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

let handle: DatabaseHandle;
let userA: string;
let userB: string;

async function insertUser(email: string): Promise<string> {
  const [row] = await handle.db
    .insert(users)
    .values({ email, name: 'Pablo Moreno', passwordHash: 'x', role: 'USER' })
    .returning();
  if (!row) throw new Error('No se ha insertado el usuario');
  return row.id;
}

beforeEach(async () => {
  handle = await createTestDatabase();
  userA = await insertUser('a@incidapp.test');
  userB = await insertUser('b@incidapp.test');
});

afterEach(async () => {
  await handle.close();
});

const sessionIds = async () =>
  (await handle.db.select({ id: sessions.id }).from(sessions)).map((row) => row.id).sort();

describe('createDrizzleSessionRepository', () => {
  it('CA-01.1: create guarda la sesión con su caducidad y findById la recupera', async () => {
    const repo = createDrizzleSessionRepository(handle.db);
    const session = { id: 'a'.repeat(64), userId: userA, expiresAt: at(1000), createdAt: NOW };

    await repo.create(session);

    expect(await repo.findById(session.id)).toEqual(session);
  });

  it('CA-01.5: findById devuelve null si no existe', async () => {
    const repo = createDrizzleSessionRepository(handle.db);

    expect(await repo.findById('no-existe')).toBeNull();
  });

  it('CA-01.7: delete borra solo esa sesión y no falla si no existe', async () => {
    const repo = createDrizzleSessionRepository(handle.db);
    await repo.create({ id: 's1', userId: userA, expiresAt: at(1000), createdAt: NOW });
    await repo.create({ id: 's2', userId: userA, expiresAt: at(1000), createdAt: NOW });

    await repo.delete('s1');
    await repo.delete('s1');

    expect(await sessionIds()).toEqual(['s2']);
  });

  it('CA-01.6: deleteAllForUser borra todas las sesiones del usuario y solo las suyas', async () => {
    const repo = createDrizzleSessionRepository(handle.db);
    await repo.create({ id: 'a1', userId: userA, expiresAt: at(1000), createdAt: NOW });
    await repo.create({ id: 'a2', userId: userA, expiresAt: at(1000), createdAt: NOW });
    await repo.create({ id: 'b1', userId: userB, expiresAt: at(1000), createdAt: NOW });

    await repo.deleteAllForUser(userA);

    expect(await sessionIds()).toEqual(['b1']);
  });

  it('CA-01.6: deleteExpiredForUser borra las caducadas del usuario (incluida la que caduca en ese instante)', async () => {
    const repo = createDrizzleSessionRepository(handle.db);
    await repo.create({ id: 'a-caducada', userId: userA, expiresAt: at(-1), createdAt: NOW });
    await repo.create({ id: 'a-justo', userId: userA, expiresAt: at(0), createdAt: NOW });
    await repo.create({ id: 'a-vigente', userId: userA, expiresAt: at(1), createdAt: NOW });
    await repo.create({ id: 'b-caducada', userId: userB, expiresAt: at(-1), createdAt: NOW });

    await repo.deleteExpiredForUser(userA, NOW);

    expect(await sessionIds()).toEqual(['a-vigente', 'b-caducada']);
  });
});
