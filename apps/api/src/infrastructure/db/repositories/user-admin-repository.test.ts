import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '../../../application/errors';
import type { DatabaseHandle } from '../client';
import { departments, userDepartments, users } from '../schema';
import { createTestDatabase } from '../test-database';
import { createDrizzleUserAdminRepository } from './user-admin-repository';

const CREATED_AT = new Date('2026-11-23T10:00:00.000Z');
const HASH = '$argon2id$v=19$m=19456,t=2,p=1$ficticio';

let handle: DatabaseHandle;
let dept: Record<'LOG' | 'CAL' | 'TEC', { id: string; code: string; name: string }>;

beforeEach(async () => {
  handle = await createTestDatabase();
  const rows = await handle.db
    .insert(departments)
    .values([
      { code: 'LOG', name: 'Logística y Almacén' },
      { code: 'CAL', name: 'Calidad' },
      { code: 'TEC', name: 'Departamento Técnico' },
    ])
    .returning();
  dept = Object.fromEntries(
    rows.map(({ id, code, name }) => [code, { id, code, name }]),
  ) as typeof dept;
});

afterEach(async () => {
  await handle.close();
});

const newUser = (overrides: { email?: string; name?: string; departmentIds?: string[] } = {}) => ({
  email: overrides.email ?? 'rosa.navarro@incidapp.test',
  name: overrides.name ?? 'Rosa Navarro',
  role: 'MANAGER' as const,
  departmentIds: overrides.departmentIds ?? [dept.TEC.id, dept.CAL.id],
  passwordHash: HASH,
  createdAt: CREATED_AT,
});

describe('createDrizzleUserAdminRepository', () => {
  it('CA-02.7: create guarda el usuario activo con su hash y sus departamentos y lo devuelve sin hash', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);

    const created = await repo.create(newUser());

    expect(created).toEqual({
      id: expect.any(String),
      email: 'rosa.navarro@incidapp.test',
      name: 'Rosa Navarro',
      role: 'MANAGER',
      active: true,
      departments: [dept.CAL, dept.TEC],
      createdAt: CREATED_AT,
    });
    const [row] = await handle.db.select().from(users).where(eq(users.id, created.id));
    expect(row?.passwordHash).toBe(HASH);
  });

  it('CA-02.7: create con un email repetido lanza ConflictError (carrera con el índice único)', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    await repo.create(newUser());

    const error = await repo.create(newUser({ name: 'Otra' })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ message: 'Ya existe un usuario con ese email.' });
  });

  it('CA-02.6: list devuelve todos, activos y desactivados, ordenados por nombre y con sus departamentos', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const zoe = await repo.create(newUser({ email: 'z@incidapp.test', name: 'Zoe Martín' }));
    await repo.create(
      newUser({ email: 'a@incidapp.test', name: 'Ana Gil', departmentIds: [dept.LOG.id] }),
    );
    await repo.setActive(zoe.id, false);

    const list = await repo.list();

    expect(
      list.map((user) => [user.name, user.active, user.departments.map((d) => d.code)]),
    ).toEqual([
      ['Ana Gil', true, ['LOG']],
      ['Zoe Martín', false, ['CAL', 'TEC']],
    ]);
    expect(list[0]).not.toHaveProperty('passwordHash');
  });

  it('CA-02.6: findById devuelve el usuario, o null si no existe o el id no es un UUID', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const created = await repo.create(newUser());

    expect(await repo.findById(created.id)).toEqual(created);
    expect(await repo.findById('00000000-0000-4000-8000-00000000ffff')).toBeNull();
    expect(await repo.findById('no-es-un-uuid')).toBeNull();
  });

  it('CA-02.7: findByEmail encuentra también a un usuario desactivado', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const created = await repo.create(newUser());
    await repo.setActive(created.id, false);

    expect(await repo.findByEmail(created.email)).toMatchObject({ id: created.id, active: false });
    expect(await repo.findByEmail('nadie@incidapp.test')).toBeNull();
  });

  it('CA-02.8: update cambia solo los campos indicados y sustituye los departamentos', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const created = await repo.create(newUser());

    const updated = await repo.update(created.id, {
      name: 'Rosa Navarro Gil',
      departmentIds: [dept.LOG.id],
    });

    expect(updated).toEqual({ ...created, name: 'Rosa Navarro Gil', departments: [dept.LOG] });
    expect(
      await handle.db.select().from(userDepartments).where(eq(userDepartments.userId, created.id)),
    ).toEqual([{ userId: created.id, departmentId: dept.LOG.id }]);
  });

  it('CA-02.8: update de email y rol', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const created = await repo.create(newUser());

    const updated = await repo.update(created.id, { email: 'rosa@incidapp.test', role: 'USER' });

    expect(updated).toMatchObject({
      email: 'rosa@incidapp.test',
      role: 'USER',
      name: created.name,
    });
  });

  it('CA-02.8: update con el email de otro usuario lanza ConflictError', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const first = await repo.create(newUser());
    const second = await repo.create(newUser({ email: 'otro@incidapp.test' }));

    await expect(repo.update(second.id, { email: first.email })).rejects.toThrow(ConflictError);
  });

  it('CA-02.9: setActive cambia el estado y devuelve el usuario', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const created = await repo.create(newUser());

    expect((await repo.setActive(created.id, false)).active).toBe(false);
    expect((await repo.setActive(created.id, true)).active).toBe(true);
  });

  it('CA-02.12: setPasswordHash sustituye el hash', async () => {
    const repo = createDrizzleUserAdminRepository(handle.db);
    const created = await repo.create(newUser());

    await repo.setPasswordHash(created.id, '$argon2id$otro');

    const [row] = await handle.db.select().from(users).where(eq(users.id, created.id));
    expect(row?.passwordHash).toBe('$argon2id$otro');
  });
});
