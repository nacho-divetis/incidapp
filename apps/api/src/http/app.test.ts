import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { ErrorResponse } from '@incidapp/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { GetHealth } from '../application/health/get-health';
import { buildApp } from './app';
import { unusedAuth } from './test-support';

const INDEX_HTML =
  '<!doctype html><html><head><title>IncidApp</title></head><body><div id="root"></div></body></html>';
const ASSET_JS = 'console.log("IncidApp");';
const getHealth: GetHealth = async () => ({ status: 'ok', db: 'ok', version: '0.1.0' });

let webDistDir: string;
let app: FastifyInstance | undefined;

beforeAll(async () => {
  // Build de la web de prueba (fixture), como el que genera Vite en `apps/web/dist`.
  webDistDir = await mkdtemp(path.join(tmpdir(), 'incidapp-web-dist-'));
  await mkdir(path.join(webDistDir, 'assets'));
  await writeFile(path.join(webDistDir, 'index.html'), INDEX_HTML);
  await writeFile(path.join(webDistDir, 'assets', 'index-abc123.js'), ASSET_JS);
});

afterAll(async () => {
  await rm(webDistDir, { recursive: true, force: true });
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('buildApp · servicio de la SPA', () => {
  it('CA-00.6: GET / devuelve el index.html de la SPA', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toBe(INDEX_HTML);
  });

  it.each(['/incidencias/123', '/incidencias/123?pestana=historial', '/usuarios'])(
    'CA-00.6: una ruta de cliente desconocida (%s) también devuelve el index.html',
    async (url) => {
      app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toBe(INDEX_HTML);
    },
  );

  it('CA-00.6: sirve los archivos estáticos del build', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

    const response = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('javascript');
    expect(response.body).toBe(ASSET_JS);
  });

  it.each(['/api/no-existe', '/api', '/api/health/extra', '/api/no-existe.js'])(
    'CA-00.6: una ruta de API desconocida (%s) devuelve 404 con ErrorResponse, nunca el HTML',
    async (url) => {
      app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
      expect(ErrorResponse.parse(response.json())).toEqual({
        error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
      });
    },
  );

  it('CA-00.6: un archivo estático inexistente devuelve 404 JSON, no el index.html', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

    const response = await app.inject({ method: 'GET', url: '/assets/no-existe.js' });

    expect(response.statusCode).toBe(404);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it('CA-00.6: un método distinto de GET en una ruta de cliente devuelve 404 JSON', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

    const response = await app.inject({ method: 'POST', url: '/incidencias/123' });

    expect(response.statusCode).toBe(404);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('NOT_FOUND');
  });

  it('CA-00.6: sin build de la web (desarrollo) la API funciona y el resto responde 404 JSON', async () => {
    app = await buildApp({
      auth: unusedAuth,
      getHealth,
      webDistDir: path.join(webDistDir, 'no-existe'),
    });

    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(404);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('buildApp · cabeceras de seguridad', () => {
  it.each([
    ['la API', '/api/health', 200],
    ['la SPA', '/incidencias/123', 200],
    ['un archivo estático', '/assets/index-abc123.js', 200],
    ['un 404 de la API', '/api/no-existe', 404],
  ])('CA-00.5: %s lleva las cabeceras de Helmet, incluida una CSP', async (_case, url, status) => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir });

    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(status);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toBeDefined();
  });

  it('CA-00.5: un error no previsto (500) también lleva las cabeceras de Helmet', async () => {
    app = await buildApp({
      auth: unusedAuth,
      getHealth: async () => {
        throw new Error('fallo interno');
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(500);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: { code: 'INTERNAL', message: 'Se ha producido un error inesperado.' },
    });
    expect(response.headers['content-security-policy']).toBeDefined();
  });
});

describe('buildApp · HTTPS según el entorno', () => {
  it('CA-00.5: con enforceHttps (producción) la CSP completa incluye upgrade-insecure-requests y hay HSTS', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir, enforceHttps: true });

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
  });

  it('CA-00.5: sin enforceHttps (fuera de producción) no hay upgrade-insecure-requests ni HSTS, para servir sobre http://localhost', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth, webDistDir, enforceHttps: false });

    const response = await app.inject({ method: 'GET', url: '/' });

    const csp = response.headers['content-security-policy'];
    expect(csp).not.toContain('upgrade-insecure-requests');
    // El resto de la CSP por defecto se mantiene.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('buildApp · logger', () => {
  it('CA-00.5: las cabeceras authorization y cookie nunca llegan al log, ni siquiera en un 500', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    app = await buildApp({
      auth: unusedAuth,
      getHealth: async () => {
        throw new Error('fallo interno');
      },
      logger: { level: 'trace', stream },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: 'Bearer secreto-1', cookie: 'sid=secreto-2' },
    });

    expect(response.statusCode).toBe(500);
    const output = lines.join('');
    // El detalle del error no previsto sí queda en el log (y solo en el log)…
    expect(output).toContain('fallo interno');
    // …pero nunca las credenciales de la petición.
    expect(output).not.toMatch(/secreto-[12]/);
  });
});
