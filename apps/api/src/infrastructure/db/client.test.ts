import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabase, pgPoolConfig } from './client';

describe('createDatabase', () => {
  it('CA-00.3: con el driver "pglite" crea una base de datos PGlite operativa', async () => {
    const handle = await createDatabase({ driver: 'pglite' });
    try {
      expect(handle.driver).toBe('pglite');
      const result = await handle.db.execute<{ one: number }>(sql`select 1 as one`);
      expect(result.rows).toEqual([{ one: 1 }]);
    } finally {
      await handle.close();
    }
  });

  it('CA-00.2: con una carpeta de datos que no existe (p. ej., .data/pglite en un clon limpio) la crea', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'incidapp-client-'));
    const dataDir = path.join(root, '.data', 'pglite');
    try {
      const handle = await createDatabase({ driver: 'pglite', dataDir });
      await handle.db.execute(sql`select 1`);
      await handle.close();
      expect(existsSync(dataDir)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('CA-00.3: con el driver "pg" usa node-postgres sin conectarse hasta la primera consulta', async () => {
    const handle = await createDatabase({
      driver: 'pg',
      url: 'postgresql://usuario:clave@db.invalid:5432/incidapp',
    });
    expect(handle.driver).toBe('pg');
    await handle.close();
  });

  it('CA-00.3: node-postgres se configura con SSL verificado y un pool de 5 conexiones', () => {
    const url = 'postgresql://usuario:clave@db.invalid:5432/incidapp';
    expect(pgPoolConfig(url)).toEqual({
      connectionString: url,
      ssl: { rejectUnauthorized: true },
      max: 5,
    });
  });
});
