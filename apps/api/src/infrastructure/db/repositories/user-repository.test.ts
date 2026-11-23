import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '../client';
import { departments, userDepartments, users } from '../schema';
import { createTestDatabase } from '../test-database';
import { createDrizzleUserRepository } from './user-repository';

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = await createTestDatabase();
  await handle.db.insert(departments).values([
    { code: 'LOG', name: 'Logística y Almacén' },
    { code: 'CAL', name: 'Calidad' },
    { code: 'TEC', name: 'Departamento Técnico' },
  ]);
});

afterEach(async () => {
  await handle.close();
});

async function insertUser(values: { email: string; active?: boolean; departmentCodes?: string[] }) {
  const [user] = await handle.db
    .insert(users)
    .values({
      email: values.email,
      name: 'Carmen Vidal',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$ficticio',
      role: 'MANAGER',
      active: values.active ?? true,
    })
    .returning();
  if (!user) throw new Error('No se ha insertado el usuario');
  const codes = values.departmentCodes ?? [];
  if (codes.length > 0) {
    const rows = await handle.db
      .select({ id: departments.id })
      .from(departments)
      .where(inArray(departments.code, codes));
    await handle.db
      .insert(userDepartments)
      .values(rows.map((row) => ({ userId: user.id, departmentId: row.id })));
  }
  return user;
}

describe('createDrizzleUserRepository', () => {
  it('CA-01.1: findAccountByEmail devuelve la cuenta con su hash y su estado', async () => {
    const user = await insertUser({ email: 'responsable@incidapp.test' });
    const repo = createDrizzleUserRepository(handle.db);

    expect(await repo.findAccountByEmail('responsable@incidapp.test')).toEqual({
      id: user.id,
      email: 'responsable@incidapp.test',
      name: 'Carmen Vidal',
      role: 'MANAGER',
      active: true,
      passwordHash: user.passwordHash,
    });
  });

  it('CA-01.2: findAccountByEmail devuelve null si el email no existe', async () => {
    await insertUser({ email: 'responsable@incidapp.test' });
    const repo = createDrizzleUserRepository(handle.db);

    expect(await repo.findAccountByEmail('nadie@incidapp.test')).toBeNull();
  });

  it('CA-01.5: findCurrentUser devuelve el usuario con sus departamentos ordenados por código, sin datos internos', async () => {
    const user = await insertUser({
      email: 'responsable@incidapp.test',
      departmentCodes: ['TEC', 'CAL'],
    });
    const repo = createDrizzleUserRepository(handle.db);

    const record = await repo.findCurrentUser(user.id);

    expect(record?.active).toBe(true);
    expect(record?.user).toEqual({
      id: user.id,
      email: 'responsable@incidapp.test',
      name: 'Carmen Vidal',
      role: 'MANAGER',
      departments: [
        { id: expect.any(String), code: 'CAL', name: 'Calidad' },
        { id: expect.any(String), code: 'TEC', name: 'Departamento Técnico' },
      ],
    });
    expect(record?.user).not.toHaveProperty('passwordHash');
  });

  it('CA-01.5: findCurrentUser devuelve departments vacío si no tiene ninguno', async () => {
    const user = await insertUser({ email: 'responsable@incidapp.test' });
    const repo = createDrizzleUserRepository(handle.db);

    expect((await repo.findCurrentUser(user.id))?.user.departments).toEqual([]);
  });

  it('CA-01.6: findCurrentUser indica si el usuario está desactivado', async () => {
    const user = await insertUser({ email: 'baja@incidapp.test', active: false });
    const repo = createDrizzleUserRepository(handle.db);

    expect((await repo.findCurrentUser(user.id))?.active).toBe(false);
  });

  it('CA-01.5: findCurrentUser devuelve null si el usuario no existe', async () => {
    const repo = createDrizzleUserRepository(handle.db);

    expect(await repo.findCurrentUser('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});
