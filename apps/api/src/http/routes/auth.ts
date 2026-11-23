import { CurrentUser, LoginInput } from '@incidapp/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Login } from '../../application/auth/login';
import type { Logout } from '../../application/auth/logout';
import type { ResolveSession } from '../../application/auth/resolve-session';
import { currentUserOf, makeRequireSession } from '../auth/require-session';
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
  type SessionCookieSettings,
} from '../auth/session-cookie';
import { TooManyRequestsError } from '../error-handler';
import { rateLimitKey } from '../rate-limit-key';

export const LOGIN_RATE_LIMIT_MESSAGE =
  'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en unos minutos.';

/** Límite de intentos de login por IP (CA-01.8). */
export interface LoginRateLimitSettings {
  max: number;
  timeWindowMs: number;
}

export interface AuthRoutesDeps {
  login: Login;
  logout: Logout;
  resolveSession: ResolveSession;
  loginRateLimit: LoginRateLimitSettings;
  cookie: SessionCookieSettings;
}

/**
 * `POST /auth/login`, `POST /auth/logout` y `GET /auth/me` (bajo el prefijo `/api`). Las rutas solo
 * traducen HTTP ↔ casos de uso: la lógica está en `application/auth`. Las respuestas con datos de
 * la sesión no se guardan en ninguna caché (`no-store`).
 */
export const authRoutes =
  ({
    login,
    logout,
    resolveSession,
    loginRateLimit,
    cookie,
  }: AuthRoutesDeps): FastifyPluginAsyncZod =>
  async (app) => {
    const requireSession = makeRequireSession({ resolveSession });

    app.post(
      '/auth/login',
      {
        schema: { body: LoginInput, response: { 200: CurrentUser } },
        // Solo en esta ruta (el plugin se registra con `global: false`). La clave sale de `request.ip`,
        // que con `trustProxy` es la IP real del cliente detrás del proxy de Render.
        config: {
          rateLimit: {
            max: loginRateLimit.max,
            timeWindow: loginRateLimit.timeWindowMs,
            // IPv6 agrupada por su /64 e IPv4 mapeada como IPv4 (ver `rateLimitKey`).
            keyGenerator: (request) => rateLimitKey(request.ip),
            errorResponseBuilder: () => new TooManyRequestsError(LOGIN_RATE_LIMIT_MESSAGE),
          },
        },
      },
      async (request, reply) => {
        const { user, token } = await login({
          email: request.body.email,
          password: request.body.password,
          ip: request.ip,
          currentToken: readSessionToken(request),
        });
        setSessionCookie(reply, token, cookie);
        return reply.header('cache-control', 'no-store').send(user);
      },
    );

    app.post('/auth/logout', async (request, reply) => {
      await logout({ token: readSessionToken(request) });
      clearSessionCookie(reply, cookie);
      return reply.header('cache-control', 'no-store').status(204).send();
    });

    app.get(
      '/auth/me',
      { preHandler: requireSession, schema: { response: { 200: CurrentUser } } },
      async (request, reply) =>
        reply.header('cache-control', 'no-store').send(currentUserOf(request)),
    );
  };
