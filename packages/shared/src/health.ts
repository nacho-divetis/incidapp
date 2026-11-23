import { z } from 'zod';

/** Cuerpo de `GET /api/health`: estado de la API y de la base de datos, y versión desplegada. */
export const HealthResponse = z.object({
  status: z.enum(['ok', 'error']),
  db: z.enum(['ok', 'error']),
  version: z.string().min(1),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
