import type { Priority, Role, Status } from '@incidapp/shared';

/**
 * Textos en español de los valores del dominio que se muestran en la interfaz (`docs/glosario.md`).
 * Los pueden usar moléculas, organismos y páginas; los átomos no, porque no conocen el dominio.
 */

/** Nombre de cada rol tal como lo ve el usuario. */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Admin',
  DIRECTOR: 'Dirección',
  MANAGER: 'Responsable',
  USER: 'Usuario',
};

/** Nombre de cada estado de una incidencia. */
export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En curso',
  PENDING_THIRD_PARTY: 'Pendiente de tercero',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
  REJECTED: 'Rechazada',
  REOPENED: 'Reabierta',
};

/** Nombre de cada prioridad de una incidencia. */
export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};
