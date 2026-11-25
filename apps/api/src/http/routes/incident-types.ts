import { IncidentTypeSummary } from '@incidapp/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ResolveSession } from '../../application/auth/resolve-session';
import type { ListIncidentTypes } from '../../application/incidents/list-incident-types';
import { makeRequireSession } from '../auth/require-session';

/** Casos de uso del catálogo de tipos de incidencia. */
export interface IncidentTypesDeps {
  listIncidentTypes: ListIncidentTypes;
}

export interface IncidentTypesRoutesDeps extends IncidentTypesDeps {
  resolveSession: ResolveSession;
}

/**
 * `GET /incident-types` (bajo el prefijo `/api`): el catálogo con su departamento por defecto, para
 * cualquier usuario con sesión (CA-03.1).
 */
export const incidentTypesRoutes =
  ({ resolveSession, listIncidentTypes }: IncidentTypesRoutesDeps): FastifyPluginAsyncZod =>
  async (app) => {
    const requireSession = makeRequireSession({ resolveSession });

    app.get(
      '/incident-types',
      { preHandler: requireSession, schema: { response: { 200: z.array(IncidentTypeSummary) } } },
      async (_request, reply) =>
        reply.header('cache-control', 'no-store').send(await listIncidentTypes()),
    );
  };
