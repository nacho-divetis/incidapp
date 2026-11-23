import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabase } from '../infrastructure/db/migrate';
import { loadConfig } from './config';
import { createContainer } from './container';

describe('createContainer', () => {
  it('CA-00.2: sin DATABASE_URL monta las dependencias sobre PGlite en disco', async () => {
    const dataRoot = await mkdtemp(path.join(tmpdir(), 'incidapp-container-'));
    const config = loadConfig({ PGLITE_DATA_DIR: path.join(dataRoot, 'pglite') });
    const container = await createContainer(config);
    try {
      expect(container.database.driver).toBe('pglite');
      await migrateDatabase(container.database);

      expect(await container.getHealth()).toEqual({
        status: 'ok',
        db: 'ok',
        version: config.version,
      });
    } finally {
      await container.close();
      await rm(dataRoot, { recursive: true, force: true });
    }
  });

  it('CA-00.3: con DATABASE_URL monta las dependencias sobre node-postgres', async () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://usuario:clave@db.invalid/incidapp' });
    const container = await createContainer(config);

    expect(container.database.driver).toBe('pg');
    await container.close();
  });
});
