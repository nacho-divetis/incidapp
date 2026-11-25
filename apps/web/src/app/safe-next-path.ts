// Rutas de vuelta tras iniciar sesión, sin *open redirect*: el parámetro `next` llega en la URL y
// cualquiera puede manipularlo, así que solo se acepta si es una ruta interna de la aplicación.
import { HOME_PATH } from './paths';

/** Ruta de la página de inicio de sesión. */
export const LOGIN_PATH = '/login';

/** Ruta a la que se va si `next` no existe o no es válido: la página de inicio (CA-07.5). */
export const DEFAULT_NEXT_PATH = HOME_PATH;

// Caracteres de control (incluidos tabulador y saltos de línea): el analizador de URL del navegador
// los elimina, así que `/\t/otro.example` acabaría siendo `//otro.example` (otro origen).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const PLACEHOLDER_ORIGIN = 'http://incidapp.invalid';

/**
 * Devuelve `next` si es una ruta interna (empieza por `/`, no por `//`, sin `\` ni caracteres de
 * control y resuelve al mismo origen) y no es la propia página de login; si no, `DEFAULT_NEXT_PATH`.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_NEXT_PATH;
  if (!next.startsWith('/') || next.startsWith('//')) return DEFAULT_NEXT_PATH;
  if (next.includes('\\') || CONTROL_CHARACTERS.test(next)) return DEFAULT_NEXT_PATH;

  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return DEFAULT_NEXT_PATH;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return DEFAULT_NEXT_PATH;
  if (url.pathname === LOGIN_PATH) return DEFAULT_NEXT_PATH;
  return next;
}

export interface LoginPathOptions {
  /** Ruta a la que volver tras iniciar sesión. */
  next?: string;
  /** Añade `expired=1` para que la página muestre el aviso de sesión caducada (CA-01.16). */
  expired?: boolean;
}

/**
 * URL de `/login` con la ruta de vuelta (`next`, si no es la página de inicio, a la que ya se va por
 * defecto) y el aviso de caducada.
 */
export function loginPath({ next, expired = false }: LoginPathOptions = {}): string {
  const params = new URLSearchParams();
  const safeNext = safeNextPath(next);
  if (safeNext !== DEFAULT_NEXT_PATH) params.set('next', safeNext);
  if (expired) params.set('expired', '1');
  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}
