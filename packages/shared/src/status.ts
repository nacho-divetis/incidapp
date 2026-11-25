import { z } from 'zod';

/**
 * Estados de una incidencia (`docs/glosario.md`). F02 lo usa en la `AuthorizationPolicy` (el
 * Usuario solo edita mientras está `OPEN`); F03 y F04 lo reutilizan para las incidencias y su
 * máquina de estados.
 */
export const Status = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'PENDING_THIRD_PARTY',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'REOPENED',
]);
export type Status = z.infer<typeof Status>;
