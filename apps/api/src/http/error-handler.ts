// Traduce los errores a respuestas HTTP con el cuerpo `ErrorResponse` de `shared`.
// Es el único sitio donde los errores de aplicación se convierten en códigos HTTP.
import type { ErrorCode, ErrorDetail, ErrorResponse } from '@incidapp/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../application/errors';

const INVALID_DATA_MESSAGE = 'Los datos enviados no son válidos.';
const INVALID_REQUEST_MESSAGE = 'La petición no es válida.';
const UNEXPECTED_ERROR_MESSAGE = 'Se ha producido un error inesperado.';

interface HttpError {
  status: number;
  body: ErrorResponse;
}

const errorBody = (code: ErrorCode, message: string, details?: ErrorDetail[]): ErrorResponse => ({
  error: details ? { code, message, details } : { code, message },
});

/** Códigos HTTP de los errores de aplicación tipados. */
const APP_ERRORS: [new (...args: never[]) => AppError, number, ErrorCode][] = [
  [ValidationError, 400, 'VALIDATION'],
  [UnauthorizedError, 401, 'UNAUTHORIZED'],
  [ForbiddenError, 403, 'FORBIDDEN'],
  [NotFoundError, 404, 'NOT_FOUND'],
  [ConflictError, 409, 'CONFLICT'],
];

/** `/items/0/name` → `items.0.name` */
const toFieldPath = (instancePath: string): string =>
  instancePath.replace(/^\//, '').split('/').join('.');

export function toHttpError(error: unknown): HttpError {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((issue) => ({
      path: toFieldPath(issue.instancePath),
      message: issue.message ?? INVALID_DATA_MESSAGE,
    }));
    return { status: 400, body: errorBody('VALIDATION', INVALID_DATA_MESSAGE, details) };
  }

  if (error instanceof AppError) {
    for (const [ErrorClass, status, code] of APP_ERRORS) {
      if (error instanceof ErrorClass) {
        const details = error instanceof ValidationError ? error.details : undefined;
        return { status, body: errorBody(code, error.message, details) };
      }
    }
  }

  // Errores de cliente de Fastify (JSON mal formado, tipo de contenido no admitido, cuerpo demasiado grande…).
  // Su mensaje original está en inglés y puede describir detalles internos: se sustituye por uno genérico.
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { status, body: errorBody('VALIDATION', INVALID_REQUEST_MESSAGE) };
  }

  return { status: 500, body: errorBody('INTERNAL', UNEXPECTED_ERROR_MESSAGE) };
}

/** Manejador de errores global de Fastify. El detalle de un error no previsto va solo al log. */
export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  const { status, body } = toHttpError(error);
  if (status >= 500) {
    request.log.error({ err: error }, 'Error no previsto al atender la petición');
  }
  return reply.status(status).send(body);
}
