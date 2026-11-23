import { describe, expect, it } from 'vitest';
import { createDatabaseHealth } from './database-health';
import { createTestDatabase } from './test-database';

describe('createDatabaseHealth', () => {
  it('CA-00.4: ping resuelve con la base de datos disponible', async () => {
    const handle = await createTestDatabase();
    try {
      await expect(createDatabaseHealth(handle.db).ping()).resolves.toBeUndefined();
    } finally {
      await handle.close();
    }
  });

  it('CA-00.4: ping rechaza si la base de datos no responde', async () => {
    const handle = await createTestDatabase();
    await handle.close();

    await expect(createDatabaseHealth(handle.db).ping()).rejects.toThrow();
  });
});
