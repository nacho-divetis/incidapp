import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from './client';
import { migrateDatabase } from './migrate';

let handle: DatabaseHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const tableNames = async (db: DatabaseHandle['db']) => {
  const result = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  return result.rows.map((row) => row.table_name);
};

const appliedMigrations = async (db: DatabaseHandle['db']) => {
  const result = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
  );
  return result.rows[0]?.count;
};

describe('migrateDatabase', () => {
  it('CA-00.8: sobre una base de datos vacía aplica las migraciones generadas (departamentos, usuarios, sesiones y auditoría)', async () => {
    handle = await createDatabase({ driver: 'pglite' });
    expect(await tableNames(handle.db)).toEqual([]);

    await migrateDatabase(handle);

    expect(await tableNames(handle.db)).toEqual([
      'audit_log',
      'departments',
      'sessions',
      'user_departments',
      'users',
    ]);
    expect(await appliedMigrations(handle.db)).toBeGreaterThan(0);
  });

  it('CA-00.8: ejecutarlo una segunda vez no falla ni cambia nada', async () => {
    handle = await createDatabase({ driver: 'pglite' });
    await migrateDatabase(handle);
    const tablesBefore = await tableNames(handle.db);
    const migrationsBefore = await appliedMigrations(handle.db);

    await expect(migrateDatabase(handle)).resolves.toBeUndefined();

    expect(await tableNames(handle.db)).toEqual(tablesBefore);
    expect(await appliedMigrations(handle.db)).toBe(migrationsBefore);
  });
});
