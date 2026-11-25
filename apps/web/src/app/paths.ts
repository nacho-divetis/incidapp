// Rutas de la web que se enlazan desde varias piezas (router, navegación y páginas). Una sola
// fuente para no repetir las cadenas.

export const HOME_PATH = '/';

/** Listado de la gestión de usuarios (CA-02.18). */
export const USERS_PATH = '/admin/usuarios';

/** Alta de un usuario (CA-02.19). */
export const USER_CREATE_PATH = `${USERS_PATH}/nuevo`;

/** Edición de un usuario (CA-02.19 a CA-02.21). */
export function userEditPath(id: string): string {
  return `${USERS_PATH}/${encodeURIComponent(id)}`;
}
