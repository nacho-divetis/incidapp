// Máquina de estados de una incidencia (`docs/permisos.md`, "Transiciones de estado"). TypeScript puro.
// Decide qué transiciones existen; quién puede hacer cada tipo lo decide la `AuthorizationPolicy`.

import type { IncidentStatus } from './incident';

/** Operativa: la puede hacer quien trabaja la incidencia. Gestión: solo Admin y Responsable. */
export type TransitionKind = 'operational' | 'management';

/** Una fila de la tabla de transiciones. */
export interface StatusTransition {
  from: IncidentStatus;
  to: IncidentStatus;
  kind: TransitionKind;
  requiresComment: boolean;
}

/** Las 9 transiciones de `permisos.md`, en el orden de su tabla. Cualquier otro par no existe. */
export const STATUS_TRANSITIONS: readonly StatusTransition[] = [
  { from: 'OPEN', to: 'IN_PROGRESS', kind: 'operational', requiresComment: false },
  { from: 'OPEN', to: 'REJECTED', kind: 'management', requiresComment: true },
  { from: 'IN_PROGRESS', to: 'PENDING_THIRD_PARTY', kind: 'operational', requiresComment: false },
  { from: 'PENDING_THIRD_PARTY', to: 'IN_PROGRESS', kind: 'operational', requiresComment: false },
  { from: 'IN_PROGRESS', to: 'RESOLVED', kind: 'operational', requiresComment: true },
  { from: 'RESOLVED', to: 'IN_PROGRESS', kind: 'management', requiresComment: true },
  { from: 'RESOLVED', to: 'CLOSED', kind: 'management', requiresComment: false },
  { from: 'CLOSED', to: 'REOPENED', kind: 'management', requiresComment: true },
  { from: 'REOPENED', to: 'IN_PROGRESS', kind: 'operational', requiresComment: false },
];

/**
 * El par (origen, destino) no es una transición de la máquina. Error de dominio: la capa de
 * aplicación lo traduce a un `ConflictError` con los nombres de los estados en español.
 */
export class InvalidTransitionError extends Error {
  readonly from: IncidentStatus;
  readonly to: IncidentStatus;

  constructor(from: IncidentStatus, to: IncidentStatus) {
    super(`No existe la transición ${from} → ${to}.`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

/** La transición de `from` a `to`, o `InvalidTransitionError` si no existe. */
export function findTransition(from: IncidentStatus, to: IncidentStatus): StatusTransition {
  const transition = STATUS_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) throw new InvalidTransitionError(from, to);
  return transition;
}

/** Las transiciones que salen de `from` (ninguna desde `REJECTED`). */
export function transitionsFrom(from: IncidentStatus): StatusTransition[] {
  return STATUS_TRANSITIONS.filter((t) => t.from === from);
}
