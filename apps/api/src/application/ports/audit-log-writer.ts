import type { AuditAction } from '@incidapp/shared';

/** Valor que se guarda en `before`/`after`: un objeto serializable a JSON. */
export type AuditData = Record<string, string | number | boolean | null>;

/** Entrada de auditoría. Nunca contiene contraseñas, *hashes* ni *tokens*. */
export interface AuditEntry {
  /** Usuario que actúa; `null` si no se conoce (p. ej., login con un email que no existe). */
  actorId: string | null;
  action: AuditAction;
  /** Tipo de entidad afectada (`user`…). */
  entity: string;
  entityId: string | null;
  before?: AuditData | null;
  after?: AuditData | null;
  /** IP del cliente, si se conoce. */
  ip: string | null;
  createdAt: Date;
}

/**
 * Puerto de la auditoría. `audit_log` es **solo de inserción** (RNF-09): este puerto solo ofrece
 * `record`, sin operaciones para actualizar ni borrar.
 */
export interface AuditLogWriter {
  record(entry: AuditEntry): Promise<void>;
}
