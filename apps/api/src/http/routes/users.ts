import { CreateUserInput, ResetPasswordInput, UpdateUserInput, UserAdmin } from '@incidapp/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ResolveSession } from '../../application/auth/resolve-session';
import type { CreateUser } from '../../application/users/create-user';
import type { GetUser } from '../../application/users/get-user';
import type { ListUsers } from '../../application/users/list-users';
import type { ResetUserPassword } from '../../application/users/reset-user-password';
import type { SetUserActive } from '../../application/users/set-user-active';
import type { UpdateUser } from '../../application/users/update-user';
import { assertCanManageUsers } from '../../application/users/user-admin-support';
import { currentUserOf, makeRequireSession } from '../auth/require-session';

/** Casos de uso de la gestión de usuarios. */
export interface UserAdminDeps {
  listUsers: ListUsers;
  getUser: GetUser;
  createUser: CreateUser;
  updateUser: UpdateUser;
  setUserActive: SetUserActive;
  resetUserPassword: ResetUserPassword;
}

export interface UsersRoutesDeps extends UserAdminDeps {
  resolveSession: ResolveSession;
}

/**
 * El id llega como texto: un id que no es un UUID se trata como inexistente (404, CA-02.6), no
 * como un 400; lo resuelve el repositorio.
 */
const UserIdParams = z.object({ id: z.string() });

/**
 * `/users…` (bajo el prefijo `/api`), solo para el Admin (CA-02.5 a CA-02.13). Las rutas solo
 * traducen HTTP ↔ casos de uso.
 *
 * Orden de las comprobaciones: sesión (401) → `manageUsers` (403) → validación del cuerpo (400) →
 * caso de uso (404, 409…). La sesión y el permiso van en `preValidation`, antes que la validación
 * de Fastify, para que un no-Admin reciba siempre 403 y no sepa nada del cuerpo ni del id. El
 * permiso lo decide la `AuthorizationPolicy` (`assertCanManageUsers`); los casos de uso lo vuelven
 * a comprobar.
 */
export const usersRoutes =
  ({ resolveSession, ...useCases }: UsersRoutesDeps): FastifyPluginAsyncZod =>
  async (app) => {
    const requireSession = makeRequireSession({ resolveSession });
    app.addHook('preValidation', requireSession);
    app.addHook('preValidation', async (request) => {
      assertCanManageUsers(currentUserOf(request));
    });
    // Datos de usuarios: ninguna respuesta (tampoco los errores) se guarda en una caché.
    app.addHook('onSend', async (_request, reply, payload) => {
      reply.header('cache-control', 'no-store');
      return payload;
    });

    app.get('/users', { schema: { response: { 200: z.array(UserAdmin) } } }, async (request) =>
      useCases.listUsers(currentUserOf(request)),
    );

    app.get(
      '/users/:id',
      { schema: { params: UserIdParams, response: { 200: UserAdmin } } },
      async (request) => useCases.getUser(currentUserOf(request), request.params.id),
    );

    app.post(
      '/users',
      { schema: { body: CreateUserInput, response: { 201: UserAdmin } } },
      async (request, reply) => {
        const user = await useCases.createUser({
          actor: currentUserOf(request),
          input: request.body,
          ip: request.ip,
        });
        return reply.status(201).send(user);
      },
    );

    app.patch(
      '/users/:id',
      { schema: { params: UserIdParams, body: UpdateUserInput, response: { 200: UserAdmin } } },
      async (request) =>
        useCases.updateUser({
          actor: currentUserOf(request),
          id: request.params.id,
          input: request.body,
          ip: request.ip,
        }),
    );

    for (const [path, active] of [
      ['/users/:id/deactivate', false],
      ['/users/:id/activate', true],
    ] as const) {
      app.post(
        path,
        { schema: { params: UserIdParams, response: { 200: UserAdmin } } },
        async (request) =>
          useCases.setUserActive({
            actor: currentUserOf(request),
            id: request.params.id,
            active,
            ip: request.ip,
          }),
      );
    }

    app.post(
      '/users/:id/password',
      { schema: { params: UserIdParams, body: ResetPasswordInput } },
      async (request, reply) => {
        await useCases.resetUserPassword({
          actor: currentUserOf(request),
          id: request.params.id,
          password: request.body.password,
          ip: request.ip,
        });
        return reply.status(204).send();
      },
    );
  };
