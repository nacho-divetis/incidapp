import {
  AssignIncidentInput,
  CreateIncidentInput,
  Incident,
  IncidentEventList,
  IncidentListQuery,
  IncidentListResponse,
  TransitionInput,
  UpdateIncidentInput,
  UserSummary,
} from '@incidapp/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ResolveSession } from '../../application/auth/resolve-session';
import type { AssignIncident } from '../../application/incidents/assign-incident';
import type { ChangeIncidentStatus } from '../../application/incidents/change-incident-status';
import type { CreateIncident } from '../../application/incidents/create-incident';
import type { GetIncident } from '../../application/incidents/get-incident';
import { assertCanCreateIncident } from '../../application/incidents/incident-support';
import type { ListAssignees } from '../../application/incidents/list-assignees';
import type { ListIncidentEvents } from '../../application/incidents/list-incident-events';
import type { ListIncidents } from '../../application/incidents/list-incidents';
import type { UpdateIncident } from '../../application/incidents/update-incident';
import { currentUserOf, makeRequireSession } from '../auth/require-session';

/** Casos de uso de las incidencias. */
export interface IncidentsDeps {
  listIncidents: ListIncidents;
  getIncident: GetIncident;
  createIncident: CreateIncident;
  updateIncident: UpdateIncident;
  listAssignees: ListAssignees;
  assignIncident: AssignIncident;
  changeIncidentStatus: ChangeIncidentStatus;
  listIncidentEvents: ListIncidentEvents;
}

export interface IncidentsRoutesDeps extends IncidentsDeps {
  resolveSession: ResolveSession;
}

/**
 * El id llega como texto: un id que no es un UUID se trata como inexistente (404 con el mismo
 * cuerpo que el inexistente y el no visible, CA-03.6), no como un 400; lo resuelve el repositorio.
 */
const IncidentIdParams = z.object({ id: z.string() });

/**
 * `/incidents…` (bajo el prefijo `/api`, CA-03.2 a CA-03.10, CA-04.2 a CA-04.6). Las rutas solo traducen HTTP ↔ casos
 * de uso; los permisos los decide la `AuthorizationPolicy` dentro de cada caso de uso.
 *
 * Orden de las comprobaciones: sesión (401, en `preValidation`, antes que el esquema) → forma de la
 * *query* o del cuerpo (400; no depende de la incidencia, así que no revela nada) → caso de uso
 * (404 si no existe o no es visible → 403 → 400 por las reglas). En el alta, el 403 de quien no
 * puede crear va también en `preValidation`, antes que el cuerpo.
 */
export const incidentsRoutes =
  ({ resolveSession, ...useCases }: IncidentsRoutesDeps): FastifyPluginAsyncZod =>
  async (app) => {
    app.addHook('preValidation', makeRequireSession({ resolveSession }));
    // Datos de incidencias: ninguna respuesta (tampoco los errores) se guarda en una caché.
    app.addHook('onSend', async (_request, reply, payload) => {
      reply.header('cache-control', 'no-store');
      return payload;
    });

    app.get(
      '/incidents',
      { schema: { querystring: IncidentListQuery, response: { 200: IncidentListResponse } } },
      async (request) => useCases.listIncidents(currentUserOf(request), request.query),
    );

    app.post(
      '/incidents',
      {
        preValidation: async (request) => assertCanCreateIncident(currentUserOf(request)),
        schema: { body: CreateIncidentInput, response: { 201: Incident } },
      },
      async (request, reply) => {
        const incident = await useCases.createIncident({
          actor: currentUserOf(request),
          input: request.body,
        });
        return reply.status(201).send(incident);
      },
    );

    app.get(
      '/incidents/:id',
      { schema: { params: IncidentIdParams, response: { 200: Incident } } },
      async (request) => useCases.getIncident(currentUserOf(request), request.params.id),
    );

    app.patch(
      '/incidents/:id',
      {
        schema: {
          params: IncidentIdParams,
          body: UpdateIncidentInput,
          response: { 200: Incident },
        },
      },
      async (request) =>
        useCases.updateIncident({
          actor: currentUserOf(request),
          id: request.params.id,
          input: request.body,
        }),
    );

    app.get(
      '/incidents/:id/assignees',
      { schema: { params: IncidentIdParams, response: { 200: z.array(UserSummary) } } },
      async (request) => useCases.listAssignees(currentUserOf(request), request.params.id),
    );

    app.post(
      '/incidents/:id/assign',
      {
        schema: {
          params: IncidentIdParams,
          body: AssignIncidentInput,
          response: { 200: Incident },
        },
      },
      async (request) =>
        useCases.assignIncident({
          actor: currentUserOf(request),
          id: request.params.id,
          input: request.body,
        }),
    );

    // Cambio de estado (CA-04.2, CA-04.3): `status` solo cambia por aquí. Tras la forma del cuerpo,
    // el caso de uso decide en orden 404 → 409 → 403 → 400.
    app.post(
      '/incidents/:id/transitions',
      {
        schema: {
          params: IncidentIdParams,
          body: TransitionInput,
          response: { 200: Incident },
        },
      },
      async (request) =>
        useCases.changeIncidentStatus({
          actor: currentUserOf(request),
          id: request.params.id,
          input: request.body,
        }),
    );

    // Historial (CA-04.6): del más antiguo al más reciente.
    app.get(
      '/incidents/:id/events',
      { schema: { params: IncidentIdParams, response: { 200: IncidentEventList } } },
      async (request) => useCases.listIncidentEvents(currentUserOf(request), request.params.id),
    );
  };
