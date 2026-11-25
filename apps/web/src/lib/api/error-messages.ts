// Traducción de los errores de las peticiones a lo que muestran las páginas: un mensaje en español
// y, en los formularios, los errores de validación de la API repartidos por campo.
import { ApiError } from './client';

/** Mensaje cuando la petición ni siquiera llega a la API (sin conexión, servidor caído…). */
export const NETWORK_ERROR_MESSAGE =
  'No se ha podido conectar con el servidor. Inténtalo de nuevo.';

/** Mensaje en español de un error: el de la API si lo hay, o el de conexión. */
export function errorMessageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE;
}

/** Errores de un formulario: por campo y, lo que no corresponde a ningún campo, en general. */
export interface FormErrors<F extends string> {
  fieldErrors?: Partial<Record<F, string>>;
  message?: string;
}

/**
 * Reparte un error de la API entre los campos de un formulario. Un 400 con `details` cuyo primer
 * segmento de `path` es uno de `fields` va a ese campo (el primero por campo); el resto, y cualquier
 * otro error, va al mensaje general.
 */
export function formErrorsOf<F extends string>(
  error: unknown,
  fields: readonly F[],
): FormErrors<F> {
  if (!error) return {};
  if (!(error instanceof ApiError) || error.status !== 400 || !error.details?.length) {
    return { message: errorMessageOf(error) };
  }

  const fieldErrors: Partial<Record<F, string>> = {};
  let unmatched = false;
  for (const detail of error.details) {
    const field = detail.path.split('.')[0] as F;
    if (fields.includes(field)) fieldErrors[field] ??= detail.message;
    else unmatched = true;
  }
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return {
    fieldErrors: hasFieldErrors ? fieldErrors : undefined,
    message: unmatched || !hasFieldErrors ? error.message : undefined,
  };
}
