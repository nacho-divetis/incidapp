import { HealthResponse } from '@incidapp/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { GetHealth } from '../../application/health/get-health';

export interface HealthRoutesDeps {
  getHealth: GetHealth;
}

/** `GET /health` (bajo el prefijo `/api`): público. 200 si todo está bien; 503 si la base de datos no responde. */
export const healthRoutes =
  ({ getHealth }: HealthRoutesDeps): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      '/health',
      { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
      async (_request, reply) => {
        const health = await getHealth();
        return reply
          .header('cache-control', 'no-store')
          .status(health.status === 'ok' ? 200 : 503)
          .send(health);
      },
    );
  };
