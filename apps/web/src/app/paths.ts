// Rutas de la web que se enlazan desde varias piezas (router, navegación y páginas). Una sola
// fuente para no repetir las cadenas.

/** Raíz de la web: redirige a la página de inicio (`HOME_PATH`). */
export const ROOT_PATH = '/';

/** Listado de la gestión de usuarios (CA-02.18). */
export const USERS_PATH = '/admin/usuarios';

/** Alta de un usuario (CA-02.19). */
export const USER_CREATE_PATH = `${USERS_PATH}/nuevo`;

/** Edición de un usuario (CA-02.19 a CA-02.21). */
export function userEditPath(id: string): string {
  return `${USERS_PATH}/${encodeURIComponent(id)}`;
}

/** Listado de incidencias (CA-03.12). */
export const INCIDENTS_PATH = '/incidencias';

/**
 * Página de inicio: el listado de incidencias (CA-07.5). Es el destino por defecto tras iniciar
 * sesión, el de la raíz y el de los enlaces "Volver a la página de inicio".
 */
export const HOME_PATH = INCIDENTS_PATH;

/** Alta de una incidencia (CA-03.13). */
export const INCIDENT_CREATE_PATH = `${INCIDENTS_PATH}/nueva`;

/** Detalle de una incidencia (CA-03.14). */
export function incidentDetailPath(id: string): string {
  return `${INCIDENTS_PATH}/${encodeURIComponent(id)}`;
}

/** Edición de una incidencia (CA-03.15). */
export function incidentEditPath(id: string): string {
  return `${incidentDetailPath(id)}/editar`;
}
