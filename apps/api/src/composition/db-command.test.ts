// Ejecuta los comandos reales `db:migrate` y `db:seed` (con `tsx`) sobre un PGlite en una carpeta temporal.
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asc, count } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../infrastructure/db/client';
import { DEMO_INCIDENTS, DEMO_STAFF } from '../infrastructure/db/demo-incidents';
import { departments, incidentEvents, incidents, users } from '../infrastructure/db/schema';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let dataRoot: string;
let dataDir: string;

beforeAll(async () => {
  dataRoot = await mkdtemp(path.join(tmpdir(), 'incidapp-db-command-'));
  dataDir = path.join(dataRoot, 'pglite');
});

afterAll(async () => {
  await rm(dataRoot, { recursive: true, force: true });
});

function runDbCommand(command: string) {
  const { DATABASE_URL: _omitted, ...env } = process.env;
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/composition/db-command.ts', command],
    {
      cwd: apiDir,
      env: { ...env, NODE_ENV: 'development', DATABASE_URL: '', PGLITE_DATA_DIR: dataDir },
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
}

describe('db-command', () => {
  it('CA-00.8, CA-00.9 y CA-07.3: migrate y seed, dos veces cada uno, terminan bien y dejan 9 departamentos y los datos demo sin duplicar', async () => {
    for (const command of ['migrate', 'migrate', 'seed', 'seed']) {
      const result = runDbCommand(command);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    }

    const handle = await createDatabase({ driver: 'pglite', dataDir });
    try {
      const rows = await handle.db
        .select({ code: departments.code })
        .from(departments)
        .orderBy(asc(departments.code));
      expect(rows.map((row) => row.code)).toEqual([
        'ADM',
        'ATC',
        'CAL',
        'COM',
        'COMP',
        'DIR',
        'LOG',
        'PROD',
        'TEC',
      ]);

      // CA-07.1 y CA-07.3: los datos demo, una sola vez aunque el seed se haya ejecutado dos.
      const [incidentTotal] = await handle.db.select({ total: count() }).from(incidents);
      const [eventTotal] = await handle.db.select({ total: count() }).from(incidentEvents);
      const [userTotal] = await handle.db.select({ total: count() }).from(users);
      const expectedEvents = DEMO_INCIDENTS.reduce((total, i) => total + 1 + i.steps.length, 0);
      expect(incidentTotal?.total).toBe(DEMO_INCIDENTS.length);
      expect(eventTotal?.total).toBe(expectedEvents);
      expect(userTotal?.total).toBe(4 + DEMO_STAFF.length);
    } finally {
      await handle.close();
    }
  }, 120_000);

  it('rechaza un comando desconocido con un mensaje en español', () => {
    const result = runDbCommand('borrar-todo');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Comando desconocido/);
  });
});
