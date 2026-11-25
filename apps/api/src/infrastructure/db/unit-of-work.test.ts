import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from './client';
import { auditLog, departments, sessions, users } from './schema';
import { createTestDatabase } from './test-database';
import { createDrizzleUnitOfWork } from './unit-of-work';

const NOW = new Date('2026-11-23T10:00:00.000Z');

let handle: DatabaseHandle;
let departmentId: string;
let userId: string;

beforeEach(async () => {
  handle = await createTestDatabase();
  const [department] = await handle.db
    .insert(departments)
    .values({ code: 'LOG', name: 'Logística y Almacén' })
    .returning();
  departmentId = department!.id;
  const [user] = await handle.db
    .insert(users)
    .values({ email: 'lucia@incidapp.test', name: 'Lucía Gómez', passwordHash: 'x', role: 'USER' })
    .returning();
  userId = user!.id;
  await handle.db
    .insert(sessions)
    .values({ id: 's1', userId, expiresAt: new Date(NOW.getTime() + 1000), createdAt: NOW });
});

afterEach(async () => {
  await handle.close();
});

const auditRows = () => handle.db.select().from(auditLog);

describe('createDrizzleUnitOfWork', () => {
  it('CA-02.13: guarda juntos el cambio, el borrado de sesiones y la auditoría (con listas de códigos)', async () => {
    const unitOfWork = createDrizzleUnitOfWork(handle.db);

    const result = await unitOfWork.run(async (tx) => {
      await tx.users.setActive(userId, false);
      await tx.sessions.deleteAllForUser(userId);
      await tx.auditLog.record({
        actorId: userId,
        action: 'USER_UPDATED',
        entity: 'user',
        entityId: userId,
        before: { departments: ['CAL'] },
        after: { departments: ['LOG', 'TEC'] },
        ip: null,
        createdAt: NOW,
      });
      return 'hecho';
    });

    expect(result).toBe('hecho');
    const [user] = await handle.db.select().from(users).where(eq(users.id, userId));
    expect(user?.active).toBe(false);
    expect(await handle.db.select().from(sessions)).toEqual([]);
    expect(await auditRows()).toEqual([
      expect.objectContaining({
        before: { departments: ['CAL'] },
        after: { departments: ['LOG', 'TEC'] },
      }),
    ]);
  });

  it('CA-02.13: si algo falla dentro, revierte todo (ni cambio, ni sesiones borradas, ni auditoría)', async () => {
    const unitOfWork = createDrizzleUnitOfWork(handle.db);

    const error = await unitOfWork
      .run(async (tx) => {
        await tx.users.create({
          email: 'nuevo@incidapp.test',
          name: 'Nuevo',
          role: 'USER',
          departmentIds: [departmentId],
          passwordHash: 'x',
          createdAt: NOW,
        });
        await tx.users.setActive(userId, false);
        await tx.sessions.deleteAllForUser(userId);
        await tx.auditLog.record({
          actorId: userId,
          action: 'USER_DEACTIVATED',
          entity: 'user',
          entityId: userId,
          ip: null,
          createdAt: NOW,
        });
        throw new Error('Fallo simulado');
      })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ message: 'Fallo simulado' });
    expect((await handle.db.select().from(users)).map((user) => [user.email, user.active])).toEqual(
      [['lucia@incidapp.test', true]],
    );
    expect(await handle.db.select({ id: sessions.id }).from(sessions)).toEqual([{ id: 's1' }]);
    expect(await auditRows()).toEqual([]);
  });

  it('CA-02.13: si falla la propia auditoría, el cambio previo se revierte', async () => {
    const unitOfWork = createDrizzleUnitOfWork(handle.db);

    await expect(
      unitOfWork.run(async (tx) => {
        await tx.users.update(userId, { name: 'Cambiado' });
        // `actorId` que no existe: viola la clave foránea de `audit_log`.
        await tx.auditLog.record({
          actorId: '00000000-0000-4000-8000-00000000ffff',
          action: 'USER_UPDATED',
          entity: 'user',
          entityId: userId,
          ip: null,
          createdAt: NOW,
        });
      }),
    ).rejects.toThrow();

    const [user] = await handle.db.select().from(users).where(eq(users.id, userId));
    expect(user?.name).toBe('Lucía Gómez');
  });
});
