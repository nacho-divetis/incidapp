// `GET /api/incident-types` de punta a punta (CA-03.1): casos de uso, repositorios Drizzle sobre
// PGlite en memoria con el *seed* real.
import { IncidentTypeSummary } from '@incidapp/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeLogin } from '../../application/auth/login';
import { makeLogout } from '../../application/auth/logout';
import { makeResolveSession } from '../../application/auth/resolve-session';
import { FakePasswordHasher, FixedClock } from '../../application/auth/test-fakes';
import { makeListIncidentTypes } from '../../application/incidents/list-incident-types';
import { createSessionTokens } from '../../infrastructure/auth/session-tokens';
import type { DatabaseHandle } from '../../infrastructure/db/client';
import { createDrizzleAuditLogWriter } from '../../infrastructure/db/repositories/audit-log-writer';
import { createDrizzleIncidentTypeRepository } from '../../infrastructure/db/repositories/incident-type-repository';
import { createDrizzleSessionRepository } from '../../infrastructure/db/repositories/session-repository';
import { createDrizzleUserRepository } from '../../infrastructure/db/repositories/user-repository';
import { seedDatabase } from '../../infrastructure/db/seed';
import { createTestDatabase } from '../../infrastructure/db/test-database';
import { buildApp } from '../app';
import { createAuthzClient, unusedAdmin, type AuthzClient } from '../test-support';

let database: DatabaseHandle;
let app: FastifyInstance;
let api: AuthzClient;

beforeAll(async () => {
  database = await createTestDatabase();
  const passwordHasher = new FakePasswordHasher();
  await seedDatabase(database.db, { passwordHasher });
  const authDeps = {
    users: createDrizzleUserRepository(database.db),
    sessions: createDrizzleSessionRepository(database.db),
    auditLog: createDrizzleAuditLogWriter(database.db),
    passwordHasher,
    sessionTokens: createSessionTokens(),
    clock: new FixedClock(new Date('2026-11-25T10:00:00.000Z')),
  };
  app = await buildApp({
    getHealth: async () => ({ status: 'ok', db: 'ok', version: '0.1.0' }),
    auth: {
      login: makeLogin(authDeps),
      logout: makeLogout(authDeps),
      resolveSession: makeResolveSession(authDeps),
      loginRateLimit: { max: 1000, timeWindowMs: 60_000 },
    },
    ...unusedAdmin,
    incidentTypes: {
      listIncidentTypes: makeListIncidentTypes({
        incidentTypes: createDrizzleIncidentTypeRepository(database.db),
      }),
    },
    enforceHttps: false,
    logger: false,
  });
  api = await createAuthzClient(app);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

describe('GET /api/incident-types', () => {
  it.each(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER'] as const)(
    'CA-03.1: %s recibe los 7 tipos con su dpto. por defecto, ordenados por nombre',
    async (role) => {
      const response = await api.call('GET', '/api/incident-types', { token: api.tokens[role] });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const types = z.array(IncidentTypeSummary).parse(response.json());
      expect(types.map((t) => [t.name, t.department.code])).toEqual([
        ['Administrativa', 'ADM'],
        ['Calidad', 'CAL'],
        ['Cliente / Reclamación', 'ATC'],
        ['Interna / Operativa', 'PROD'],
        ['Proveedor', 'COMP'],
        ['Técnica / Instalación', 'TEC'],
        ['Transporte', 'LOG'],
      ]);
    },
  );

  it('CA-03.1: sin sesión responde 401', async () => {
    const response = await api.call('GET', '/api/incident-types');

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });
});
