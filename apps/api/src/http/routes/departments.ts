import { DepartmentSummary } from '@incidapp/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ResolveSession } from '../../application/auth/resolve-session';
import type { ListDepartments } from '../../application/departments/list-departments';
import { makeRequireSession } from '../auth/require-session';

/** Casos de uso del catálogo de departamentos. */
export interface DepartmentsDeps {
  listDepartments: ListDepartments;
}

export interface DepartmentsRoutesDeps extends DepartmentsDeps {
  resolveSession: ResolveSession;
}

/** `GET /departments` (bajo el prefijo `/api`): el catálogo, para cualquier usuario con sesión (CA-02.14). */
export const departmentsRoutes =
  ({ resolveSession, listDepartments }: DepartmentsRoutesDeps): FastifyPluginAsyncZod =>
  async (app) => {
    const requireSession = makeRequireSession({ resolveSession });

    app.get(
      '/departments',
      { preHandler: requireSession, schema: { response: { 200: z.array(DepartmentSummary) } } },
      async (_request, reply) =>
        reply.header('cache-control', 'no-store').send(await listDepartments()),
    );
  };
