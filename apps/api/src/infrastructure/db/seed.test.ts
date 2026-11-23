import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from './client';
import { departments } from './schema';
import { seedDatabase } from './seed';
import { createTestDatabase } from './test-database';

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = await createTestDatabase();
});

afterEach(async () => {
  await handle.close();
});

const departmentCodes = async () =>
  (
    await handle.db
      .select({ code: departments.code })
      .from(departments)
      .orderBy(asc(departments.code))
  ).map((row) => row.code);

const EXPECTED_CODES = ['ADM', 'ATC', 'CAL', 'COM', 'COMP', 'DIR', 'LOG', 'PROD', 'TEC'];

describe('seedDatabase', () => {
  it('CA-00.9: crea los 9 departamentos de la empresa ficticia', async () => {
    await seedDatabase(handle.db);

    expect(await departmentCodes()).toEqual(EXPECTED_CODES);
    const rows = await handle.db.select().from(departments);
    for (const row of rows) expect(row.name.length).toBeGreaterThan(0);
  });

  it('CA-00.9: ejecutarlo dos veces seguidas no duplica ningún departamento', async () => {
    await seedDatabase(handle.db);
    await seedDatabase(handle.db);

    expect(await departmentCodes()).toEqual(EXPECTED_CODES);
  });
});
