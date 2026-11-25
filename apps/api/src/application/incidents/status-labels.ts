import type { Status } from '@incidapp/shared';

/**
 * Nombres en español de los estados (`docs/glosario.md`) para los mensajes de la API, como el 409 de
 * una transición que no existe. La web tiene los suyos en `lib/labels.ts`.
 */
export const STATUS_LABELS: Record<Status, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En curso',
  PENDING_THIRD_PARTY: 'Pendiente de tercero',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
  REJECTED: 'Rechazada',
  REOPENED: 'Reabierta',
};
