import fastifyCookie from '@fastify/cookie';
import { ErrorResponse, type CurrentUser } from '@incidapp/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResolveSession } from '../../application/auth/resolve-session';
import { UnauthorizedError } from '../../application/errors';
import { errorHandler } from '../error-handler';
import { currentUserOf, decorateCurrentUser, makeRequireSession } from './require-session';

const USER: CurrentUser = {
  id: '6f1c2c1e-7b0a-4d0e-9a8e-1d2f3a4b5c6d',
  email: 'usuario@incidapp.test',
  name: 'Pablo Moreno',
  role: 'USER',
  departments: [],
  allowedActions: ['createIncident'],
};

let app: FastifyInstance;
let receivedTokens: (string | undefined)[];

/** `resolveSession` falso: solo acepta el *token* `valido`. */
const fakeResolveSession: ResolveSession = async ({ token }) => {
  receivedTokens.push(token);
  if (token !== 'valido') throw new UnauthorizedError();
  return USER;
};

async function appWithProtectedRoute(): Promise<FastifyInstance> {
  receivedTokens = [];
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  await app.register(fastifyCookie);
  decorateCurrentUser(app);
  const requireSession = makeRequireSession({ resolveSession: fakeResolveSession });
  app.get('/protegida', { preHandler: requireSession }, async (request) => currentUserOf(request));
  app.get('/publica', async (request) => ({ currentUser: request.currentUser }));
  await app.ready();
  return app;
}

afterEach(async () => {
  await app.close();
});

describe('requireSession', () => {
  it('CA-01.5: con una sesión válida deja el usuario en request.currentUser', async () => {
    await appWithProtectedRoute();

    const response = await app.inject({
      method: 'GET',
      url: '/protegida',
      cookies: { incidapp_session: 'valido' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(USER);
    expect(receivedTokens).toEqual(['valido']);
  });

  it.each([
    ['sin cookie', {}],
    ['con un token que no existe', { incidapp_session: 'desconocido' }],
  ])('CA-01.5: %s responde 401 con ErrorResponse UNAUTHORIZED', async (_case, cookies) => {
    await appWithProtectedRoute();

    const response = await app.inject({ method: 'GET', url: '/protegida', cookies });

    expect(response.statusCode).toBe(401);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('en una ruta sin requireSession, request.currentUser es null', async () => {
    await appWithProtectedRoute();

    const response = await app.inject({
      method: 'GET',
      url: '/publica',
      cookies: { incidapp_session: 'valido' },
    });

    expect(response.json()).toEqual({ currentUser: null });
    expect(receivedTokens).toEqual([]);
  });
});
