import type { UnitOfWork } from '../../application/ports/unit-of-work';
import type { Database } from './client';
import { createDrizzleAuditLogWriter } from './repositories/audit-log-writer';
import { createDrizzleIncidentCodeCounter } from './repositories/incident-code-counter';
import { createDrizzleIncidentEventWriter } from './repositories/incident-event-writer';
import { createDrizzleIncidentRepository } from './repositories/incident-repository';
import { createDrizzleSessionRepository } from './repositories/session-repository';
import { createDrizzleUserAdminRepository } from './repositories/user-admin-repository';

/**
 * Adaptador Drizzle de `UnitOfWork` (ADR-002): `db.transaction` con los repositorios creados sobre la
 * transacción. Si `work` lanza, Drizzle hace *rollback* y el error se propaga. Funciona igual con
 * PGlite y con node-postgres.
 */
export function createDrizzleUnitOfWork(db: Database): UnitOfWork {
  return {
    run: (work) =>
      db.transaction((tx) =>
        work({
          users: createDrizzleUserAdminRepository(tx),
          sessions: createDrizzleSessionRepository(tx),
          auditLog: createDrizzleAuditLogWriter(tx),
          incidents: createDrizzleIncidentRepository(tx),
          incidentCodes: createDrizzleIncidentCodeCounter(tx),
          incidentEvents: createDrizzleIncidentEventWriter(tx),
        }),
      ),
  };
}
