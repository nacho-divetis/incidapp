import { ForbiddenError, NotFoundError } from '../errors';

/** Resultado de consultar la `AuthorizationPolicy` para un recurso y una acción. */
export interface AuthorizationCheck {
  /** ¿Ve el actor el recurso? Si no, no se revela que existe. */
  visible: boolean;
  /** ¿Puede hacer la acción? Solo cuenta si el recurso es visible. */
  allowed: boolean;
}

/**
 * Ayudante de los casos de uso (CA-02.3, `permisos.md` → Respuestas de la API): recurso no visible →
 * `NotFoundError` (404); visible pero sin permiso → `ForbiddenError` (403). `http/` los traduce.
 */
export function authorize({ visible, allowed }: AuthorizationCheck): void {
  if (!visible) throw new NotFoundError();
  if (!allowed) throw new ForbiddenError();
}
