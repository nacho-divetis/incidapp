import type { AuditLogWriter } from './audit-log-writer';
import type { IncidentCodeCounter } from './incident-code-counter';
import type { IncidentEventWriter } from './incident-event-writer';
import type { IncidentRepository } from './incident-repository';
import type { SessionRepository } from './session-repository';
import type { UserAdminRepository } from './user-admin-repository';

/** Repositorios que trabajan dentro de la misma transacción. */
export interface TransactionalRepositories {
  users: UserAdminRepository;
  sessions: SessionRepository;
  auditLog: AuditLogWriter;
  incidents: IncidentRepository;
  incidentCodes: IncidentCodeCounter;
  incidentEvents: IncidentEventWriter;
}

/**
 * Unidad de trabajo (ADR-002): todo lo que hace `work` con los repositorios que recibe se guarda
 * junto o no se guarda nada. Si `work` lanza, se revierte y el error se propaga (CA-02.13).
 *
 * Dentro de `work` solo se usan los repositorios recibidos, nunca los de fuera: con PGlite, una
 * consulta fuera de la transacción abierta se quedaría esperando a que termine.
 */
export interface UnitOfWork {
  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T>;
}
