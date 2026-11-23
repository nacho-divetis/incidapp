// Errores de aplicación tipados. Los casos de uso los lanzan y solo `http/` los traduce a códigos HTTP.
// El mensaje está en español y se muestra al usuario: nunca incluye detalles internos.

/** Detalle de un error de validación por campo. */
export interface ValidationIssue {
  path: string;
  message: string;
}

/** Base de los errores de aplicación. */
export abstract class AppError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Datos de entrada no válidos (400). */
export class ValidationError extends AppError {
  readonly details: ValidationIssue[] | undefined;

  constructor(message = 'Los datos enviados no son válidos.', details?: ValidationIssue[]) {
    super(message);
    this.details = details;
  }
}

/** Falta la sesión o no es válida (401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Debes iniciar sesión.') {
    super(message);
  }
}

/** El recurso es visible pero la acción no está permitida (403). */
export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message);
  }
}

/** El recurso no existe o no es visible para el actor (404). */
export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe.') {
    super(message);
  }
}

/** La operación choca con el estado actual (409). */
export class ConflictError extends AppError {
  constructor(message = 'La operación entra en conflicto con el estado actual.') {
    super(message);
  }
}
