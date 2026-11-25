// Arranca la aplicación compilada para los E2E: base PGlite nueva en una carpeta temporal,
// migraciones y seed, y la API sirviendo el front compilado. Nunca usa DATABASE_URL (ni Neon).
// Requiere `npm run build` previo (el script `e2e` lo hace).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'apps', 'api');
const dataDir = mkdtempSync(path.join(tmpdir(), 'incidapp-e2e-'));

const { DATABASE_URL: _omitted, ...baseEnv } = process.env;
const env = {
  ...baseEnv,
  NODE_ENV: 'development',
  DATABASE_URL: '',
  PGLITE_DATA_DIR: dataDir,
  WEB_DIST_DIR: path.join(root, 'apps', 'web', 'dist'),
  PORT: process.env.E2E_PORT ?? '3100',
  HOST: '127.0.0.1',
  LOGIN_RATE_LIMIT_MAX: '10000',
};

for (const command of ['db:migrate', 'db:seed']) {
  const result = spawnSync('npm', ['run', command, '-w', '@incidapp/api'], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    rmSync(dataDir, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

process.on('exit', () => {
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // La carpeta temporal la limpia el sistema; no es un error del test.
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));

// La API arranca en este mismo proceso: al cerrar Playwright no queda ningún huérfano.
Object.assign(process.env, env);
process.chdir(apiDir);
await import(pathToFileURL(path.join(apiDir, 'dist', 'main.js')).href);
