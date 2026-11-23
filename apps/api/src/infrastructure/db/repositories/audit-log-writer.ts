import type { AuditLogWriter } from '../../../application/ports/audit-log-writer';
import type { Database } from '../client';
import { auditLog } from '../schema';

/** Adaptador Drizzle de `AuditLogWriter`. Solo inserta: `audit_log` no se actualiza ni se borra. */
export function createDrizzleAuditLogWriter(db: Database): AuditLogWriter {
  return {
    async record(entry) {
      await db.insert(auditLog).values({
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ip: entry.ip,
        createdAt: entry.createdAt,
      });
    },
  };
}
