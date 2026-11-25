// Incidencia en el dominio. TypeScript puro.

/**
 * Estados de una incidencia (`docs/permisos.md`, "Transiciones de estado"). Debe coincidir con
 * `Status` de `@incidapp/shared` (lo comprueba `incident.test.ts`).
 */
export type IncidentStatus =
  'OPEN' | 'IN_PROGRESS' | 'PENDING_THIRD_PARTY' | 'RESOLVED' | 'CLOSED' | 'REJECTED' | 'REOPENED';

/** Los 7 estados, en el orden del contrato. */
export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'REOPENED',
];
