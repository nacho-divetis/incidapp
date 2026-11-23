import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { AuditLogWriter } from '../../../application/ports/audit-log-writer';
import type { DatabaseHandle } from '../client';
import { auditLog, users } from '../schema';
import { createTestDatabase } from '../test-database';
import { createDrizzleAuditLogWriter } from './audit-log-writer';

const NOW = new Date('2026-11-23T10:00:00.000Z');
const IP = '203.0.113.7';

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = await createTestDatabase();
});

afterEach(async () => {
  await handle.close();
});

describe('createDrizzleAuditLogWriter', () => {
  it('CA-01.9: record inserta un LOGIN_SUCCEEDED con actor, entidad, id e IP', async () => {
    const [user] = await handle.db
      .insert(users)
      .values({
        email: 'admin@incidapp.test',
        name: 'Elena Ruiz',
        passwordHash: 'x',
        role: 'ADMIN',
      })
      .returning();
    const writer = createDrizzleAuditLogWriter(handle.db);

    await writer.record({
      actorId: user!.id,
      action: 'LOGIN_SUCCEEDED',
      entity: 'user',
      entityId: user!.id,
      ip: IP,
      createdAt: NOW,
    });

    expect(await handle.db.select().from(auditLog)).toEqual([
      {
        id: expect.any(String),
        actorId: user!.id,
        action: 'LOGIN_SUCCEEDED',
        entity: 'user',
        entityId: user!.id,
        before: null,
        after: null,
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-01.9: record inserta un LOGIN_FAILED sin actor con el email intentado en after', async () => {
    const writer = createDrizzleAuditLogWriter(handle.db);

    await writer.record({
      actorId: null,
      action: 'LOGIN_FAILED',
      entity: 'user',
      entityId: null,
      after: { email: 'nadie@incidapp.test', reason: 'UNKNOWN_EMAIL' },
      ip: IP,
      createdAt: NOW,
    });

    const [row] = await handle.db.select().from(auditLog);
    expect(row).toMatchObject({
      actorId: null,
      action: 'LOGIN_FAILED',
      entityId: null,
      after: { email: 'nadie@incidapp.test', reason: 'UNKNOWN_EMAIL' },
      ip: IP,
    });
  });

  it('CA-01.9: el puerto y el adaptador solo ofrecen inserción (sin update ni delete)', () => {
    expectTypeOf<keyof AuditLogWriter>().toEqualTypeOf<'record'>();
    expect(Object.keys(createDrizzleAuditLogWriter(handle.db))).toEqual(['record']);
  });
});
