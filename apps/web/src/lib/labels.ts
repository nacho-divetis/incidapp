import type { Priority, Role, Status } from '@incidapp/shared';
import type { IncidentChangedField, IncidentEvent } from '@incidapp/shared';

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

/**
 * Texto del botón de cada transición de estado (CA-04.8 y decisión 7 de la spec de F04). Las claves
 * son `ORIGEN->DESTINO` y cubren las 9 transiciones de `docs/permisos.md`.
 */
const TRANSITION_LABELS: Readonly<Partial<Record<`${Status}->${Status}`, string>>> = {
  'OPEN->IN_PROGRESS': 'Empezar',
  'OPEN->REJECTED': 'Rechazar',
  'IN_PROGRESS->PENDING_THIRD_PARTY': 'Pendiente de tercero',
  'PENDING_THIRD_PARTY->IN_PROGRESS': 'Reanudar',
  'IN_PROGRESS->RESOLVED': 'Marcar como resuelta',
  'RESOLVED->IN_PROGRESS': 'Devolver a en curso',
  'RESOLVED->CLOSED': 'Cerrar',
  'CLOSED->REOPENED': 'Reabrir',
  'REOPENED->IN_PROGRESS': 'Empezar',
};

/**
 * Texto del botón que lleva una incidencia de `from` a `to`. La web no decide qué transiciones
 * existen (las da la API en `allowedTransitions`): si llegara una sin texto propio, se nombra por
 * su estado de destino ("Pasar a Cerrada").
 */
export function transitionLabel(from: Status, to: Status): string {
  return TRANSITION_LABELS[`${from}->${to}`] ?? `Pasar a ${STATUS_LABELS[to]}`;
}

/** Nombre, en minúsculas para ir dentro de una frase, de cada campo editable de una incidencia. */
export const EVENT_FIELD_LABELS: Readonly<Record<IncidentChangedField, string>> = {
  title: 'título',
  description: 'descripción',
  priority: 'prioridad',
  dueDate: 'fecha objetivo',
};

/**
 * Frase en español que describe un evento del historial, sin el autor (CA-04.9): la línea de tiempo
 * la pone detrás de su nombre ("Ana Ruiz cambió el estado de Abierta a En curso").
 */
export function describeEvent(event: IncidentEvent): string {
  switch (event.type) {
    case 'CREATED':
      return 'creó la incidencia';
    case 'UPDATED':
      return `editó: ${event.data.changes.map((change) => EVENT_FIELD_LABELS[change.field]).join(', ')}`;
    case 'ASSIGNED':
      return event.data.from
        ? `asignó a ${event.data.to.name} (antes, a ${event.data.from.name})`
        : `asignó a ${event.data.to.name}`;
    case 'STATUS_CHANGED':
      return `cambió el estado de ${STATUS_LABELS[event.data.from]} a ${STATUS_LABELS[event.data.to]}`;
  }
}
