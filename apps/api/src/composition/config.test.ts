import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

const CWD = path.resolve('/srv/incidapp/apps/api');
const NEON_URL =
  'postgresql://usuario:clave@ep-ejemplo.eu-central-1.aws.neon.tech/incidapp?sslmode=require';

describe('loadConfig', () => {
  it('CA-00.2: sin variables usa PGlite con los datos en .data/ y los valores por defecto', () => {
    const config = loadConfig({}, CWD);

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      host: '0.0.0.0',
      database: { driver: 'pglite', dataDir: path.join(CWD, '.data', 'pglite') },
      webDistDir: path.resolve(CWD, '../web/dist'),
      version: '0.1.0',
      enforceHttps: false,
    });
  });

  it('CA-00.3: sin DATABASE_URL (o vacía, como en .env.example) usa PGlite', () => {
    expect(loadConfig({ DATABASE_URL: '' }, CWD).database.driver).toBe('pglite');
    expect(loadConfig({ NODE_ENV: 'test' }, CWD).database.driver).toBe('pglite');
  });

  it('CA-00.3: con DATABASE_URL usa node-postgres con esa conexión', () => {
    expect(loadConfig({ DATABASE_URL: NEON_URL }, CWD).database).toEqual({
      driver: 'pg',
      url: NEON_URL,
    });
    expect(
      loadConfig({ NODE_ENV: 'production', DATABASE_URL: NEON_URL }, CWD).database.driver,
    ).toBe('pg');
  });

  it.each([{}, { DATABASE_URL: '' }])(
    'CA-00.3: en producción sin DATABASE_URL (%o) falla con un error en español',
    (env) => {
      expect(() => loadConfig({ NODE_ENV: 'production', ...env }, CWD)).toThrow(ConfigError);
      expect(() => loadConfig({ NODE_ENV: 'production', ...env }, CWD)).toThrow(
        /DATABASE_URL.*obligatoria en producción/,
      );
    },
  );

  it('CA-00.3: una DATABASE_URL que no es de PostgreSQL se rechaza sin mostrar su valor', () => {
    const run = () => loadConfig({ DATABASE_URL: 'mysql://usuario:secreta@host/db' }, CWD);

    expect(run).toThrow(ConfigError);
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).not.toThrow(/secreta/);
  });

  it.each([
    ['PORT', { PORT: 'abc' }],
    ['PORT', { PORT: '70000' }],
    ['NODE_ENV', { NODE_ENV: 'staging' }],
  ])('valida %s al arrancar con un mensaje en español', (variable, env) => {
    expect(() => loadConfig(env, CWD)).toThrow(ConfigError);
    expect(() => loadConfig(env, CWD)).toThrow(new RegExp(`Configuración no válida.*${variable}`));
  });

  it('respeta PORT, HOST, PGLITE_DATA_DIR y WEB_DIST_DIR (las rutas relativas, desde apps/api)', () => {
    const config = loadConfig(
      { PORT: '10000', HOST: '127.0.0.1', PGLITE_DATA_DIR: 'tmp/db', WEB_DIST_DIR: '/var/www' },
      CWD,
    );

    expect(config.port).toBe(10000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.database).toEqual({ driver: 'pglite', dataDir: path.join(CWD, 'tmp', 'db') });
    expect(config.webDistDir).toBe(path.resolve(CWD, '/var/www'));
  });

  it.each([
    ['development', false],
    ['test', false],
    ['production', true],
  ] as const)(
    'CA-00.5: con NODE_ENV=%s, enforceHttps es %s (solo producción exige HTTPS)',
    (nodeEnv, expected) => {
      const env =
        nodeEnv === 'production'
          ? { NODE_ENV: nodeEnv, DATABASE_URL: NEON_URL }
          : { NODE_ENV: nodeEnv };

      expect(loadConfig(env, CWD).enforceHttps).toBe(expected);
    },
  );

  it('añade a la versión los 7 primeros caracteres de RENDER_GIT_COMMIT si existe', () => {
    const config = loadConfig({ RENDER_GIT_COMMIT: 'abc1234def5678' }, CWD);

    expect(config.version).toBe('0.1.0+abc1234');
  });
});
