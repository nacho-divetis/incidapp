// Prueba el arranque real del proceso (con `tsx`), sin servidor escuchando: solo el caso de error.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('main', () => {
  it('CA-00.3: en producción sin DATABASE_URL el proceso termina con un error en español', () => {
    const { DATABASE_URL: _omitted, ...env } = process.env;
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/composition/main.ts'], {
      cwd: apiDir,
      env: { ...env, NODE_ENV: 'production', DATABASE_URL: '' },
      encoding: 'utf8',
      timeout: 30_000,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DATABASE_URL.*obligatoria en producción/);
  });
});
