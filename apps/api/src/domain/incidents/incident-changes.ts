// Cambios de una edición de incidencia (CA-03.9). TypeScript puro.

import type { IncidentPriority } from './incident';

/** Campos que se pueden editar de una incidencia. `dueDate` es `AAAA-MM-DD` o `null`. */
export interface IncidentEditableFields {
  title: string;
  description: string;
  priority: IncidentPriority;
  dueDate: string | null;
}

/**
 * Un campo que cambia, con su valor anterior y el nuevo. Tiene la forma de `IncidentFieldChange`
 * del contrato (lo comprueba `incident-changes.test.ts`).
 */
export type IncidentFieldChange = {
  [K in keyof IncidentEditableFields]: {
    field: K;
    before: IncidentEditableFields[K];
    after: IncidentEditableFields[K];
  };
}[keyof IncidentEditableFields];

/** Orden en el que se listan los cambios (el del formulario). */
const EDITABLE_FIELDS = ['title', 'description', 'priority', 'dueDate'] as const;

/**
 * Los campos de `input` que cambian respecto a `before`. Un campo ausente (`undefined`) no cambia;
 * `dueDate: null` quita la fecha. Lista vacía si nada cambia (200 sin evento).
 */
export function diffIncidentFields(
  before: IncidentEditableFields,
  input: Partial<IncidentEditableFields>,
): IncidentFieldChange[] {
  const changes: IncidentFieldChange[] = [];
  for (const field of EDITABLE_FIELDS) {
    const after = input[field];
    if (after === undefined || after === before[field]) continue;
    changes.push({ field, before: before[field], after } as IncidentFieldChange);
  }
  return changes;
}
