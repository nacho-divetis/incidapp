import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_PASSWORD, DEMO_USERS } from '@incidapp/shared';
import { createArgon2PasswordHasher } from '../infrastructure/auth/argon2-password-hasher';
import { migrateDatabase } from '../infrastructure/db/migrate';
import { seedDatabase } from '../infrastructure/db/seed';
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

  it('CA-01.1: monta la autenticación con los adaptadores reales y el límite de intentos de config', async () => {
    const dataRoot = await mkdtemp(path.join(tmpdir(), 'incidapp-container-auth-'));
    const config = loadConfig({
      PGLITE_DATA_DIR: path.join(dataRoot, 'pglite'),
      LOGIN_RATE_LIMIT_MAX: '4',
      LOGIN_RATE_LIMIT_WINDOW_MS: '30000',
    });
    const container = await createContainer(config);
    try {
      await migrateDatabase(container.database);
      await seedDatabase(container.database.db, { passwordHasher: createArgon2PasswordHasher() });
      const demo = DEMO_USERS[0]!;

      const result = await container.auth.login({
        email: demo.email,
        password: DEMO_PASSWORD,
        ip: '127.0.0.1',
      });

      expect(result.user.email).toBe(demo.email);
      expect(await container.auth.resolveSession({ token: result.token })).toEqual(result.user);
      await container.auth.logout({ token: result.token });
      await expect(container.auth.resolveSession({ token: result.token })).rejects.toThrow();
      expect(container.auth.loginRateLimit).toEqual({ max: 4, timeWindowMs: 30_000 });
    } finally {
      await container.close();
      await rm(dataRoot, { recursive: true, force: true });
    }
  });

  it('CA-02.6, CA-02.14: monta la gestión de usuarios y el catálogo de departamentos con los adaptadores reales', async () => {
    const dataRoot = await mkdtemp(path.join(tmpdir(), 'incidapp-container-users-'));
    const config = loadConfig({ PGLITE_DATA_DIR: path.join(dataRoot, 'pglite') });
    const container = await createContainer(config);
    try {
      await migrateDatabase(container.database);
      await seedDatabase(container.database.db, { passwordHasher: createArgon2PasswordHasher() });
      const admin = DEMO_USERS.find((user) => user.role === 'ADMIN')!;
      const { user: actor } = await container.auth.login({
        email: admin.email,
        password: DEMO_PASSWORD,
        ip: '127.0.0.1',
      });

      const users = await container.users.listUsers(actor);

      expect(users.map((user) => user.email).sort()).toEqual(
        DEMO_USERS.map((user) => user.email).sort(),
      );
      expect(await container.departments.listDepartments()).toHaveLength(9);
    } finally {
      await container.close();
      await rm(dataRoot, { recursive: true, force: true });
    }
  });
});
