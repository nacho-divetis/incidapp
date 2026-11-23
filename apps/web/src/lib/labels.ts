import type { Role } from '@incidapp/shared';

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
