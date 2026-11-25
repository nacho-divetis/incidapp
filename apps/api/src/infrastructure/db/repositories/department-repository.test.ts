import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '../client';
import { departments } from '../schema';
import { createTestDatabase } from '../test-database';
import { createDrizzleDepartmentRepository } from './department-repository';

let handle: DatabaseHandle;
let ids: Record<string, string>;

beforeAll(async () => {
  handle = await createTestDatabase();
  const rows = await handle.db
    .insert(departments)
    .values([
      { code: 'LOG', name: 'Logística y Almacén' },
      { code: 'CAL', name: 'Calidad' },
      { code: 'ADM', name: 'Administración y Finanzas' },
    ])
    .returning();
  ids = Object.fromEntries(rows.map((row) => [row.code, row.id]));
});

afterAll(async () => {
  await handle.close();
});

describe('createDrizzleDepartmentRepository', () => {
  it('CA-02.14: list devuelve id, code y name ordenados por nombre', async () => {
    const repo = createDrizzleDepartmentRepository(handle.db);

    expect(await repo.list()).toEqual([
      { id: ids.ADM, code: 'ADM', name: 'Administración y Finanzas' },
      { id: ids.CAL, code: 'CAL', name: 'Calidad' },
      { id: ids.LOG, code: 'LOG', name: 'Logística y Almacén' },
    ]);
  });

  it('CA-02.7: findByIds devuelve solo los que existen', async () => {
    const repo = createDrizzleDepartmentRepository(handle.db);

    const found = await repo.findByIds([ids.LOG!, '00000000-0000-4000-8000-00000000dddd']);

    expect(found).toEqual([{ id: ids.LOG, code: 'LOG', name: 'Logística y Almacén' }]);
  });

  it('CA-02.7: findByIds con una lista vacía no consulta nada y devuelve []', async () => {
    const repo = createDrizzleDepartmentRepository(handle.db);

    expect(await repo.findByIds([])).toEqual([]);
  });
});
