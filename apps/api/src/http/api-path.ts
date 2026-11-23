/** Prefijo de todas las rutas de la API. */
export const API_PREFIX = '/api';

/** Indica si una ruta (sin la *query*) pertenece a la API. */
export const isApiPath = (pathname: string): boolean =>
  pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
