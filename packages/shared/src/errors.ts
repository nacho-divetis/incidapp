import { z } from 'zod';

/** Códigos de error de la API. `UNAUTHORIZED` (401) se reserva para la sesión de F01. */
export const ErrorCode = z.enum([
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Detalle de un error de validación: campo afectado y mensaje en español. */
export const ErrorDetail = z.object({
  path: z.string(),
  message: z.string().min(1),
});
export type ErrorDetail = z.infer<typeof ErrorDetail>;

/** Cuerpo de toda respuesta 4xx/5xx de `/api`. El mensaje está en español y no expone detalles internos. */
export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string().min(1),
    details: z.array(ErrorDetail).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
