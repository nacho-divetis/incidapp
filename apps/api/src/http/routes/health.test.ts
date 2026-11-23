import { HealthResponse } from '@incidapp/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { makeGetHealth } from '../../application/health/get-health';
import type { DatabaseHandle } from '../../infrastructure/db/client';
import { createDatabaseHealth } from '../../infrastructure/db/database-health';
import { createTestDatabase } from '../../infrastructure/db/test-database';
import { buildApp } from '../app';

const VERSION = '0.1.0+abc1234';

let app: FastifyInstance;
let database: DatabaseHandle;

async function appWithDatabase(): Promise<FastifyInstance> {
  database = await createTestDatabase();
  app = await buildApp({
    getHealth: makeGetHealth({
      databaseHealth: createDatabaseHealth(database.db),
      version: VERSION,
    }),
  });
  return app;
}

afterEach(async () => {
  await app.close();
  await database.close();
});

describe('GET /api/health', () => {
  it('CA-00.4: con la base de datos disponible responde 200 con HealthResponse', async () => {
    await appWithDatabase();

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(HealthResponse.parse(response.json())).toEqual({
      status: 'ok',
      db: 'ok',
      version: VERSION,
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('CA-00.4: si la base de datos no responde, 503 con status y db "error"', async () => {
    await appWithDatabase();
    await database.close();

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    expect(HealthResponse.parse(response.json())).toEqual({
      status: 'error',
      db: 'error',
      version: VERSION,
    });
  });
});
