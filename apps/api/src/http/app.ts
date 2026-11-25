// Construye la aplicación Fastify: seguridad, validación con Zod, rutas de `/api`,
// servicio de la web compilada y respuestas uniformes para lo que no existe.
import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet, { type FastifyHelmetOptions } from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
// Efecto lateral explícito: configura los mensajes de Zod en español (los `details` de un 400).
// No se deja en manos de que alguna ruta importe por casualidad un valor del contrato.
import '@incidapp/shared';
import type { ErrorResponse } from '@incidapp/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Login } from '../application/auth/login';
import type { Logout } from '../application/auth/logout';
import type { ResolveSession } from '../application/auth/resolve-session';
import type { GetHealth } from '../application/health/get-health';
import { API_PREFIX, isApiPath } from './api-path';
import { decorateCurrentUser } from './auth/require-session';
import { csrfGuard } from './csrf';
import { errorHandler } from './error-handler';
import { authRoutes, type LoginRateLimitSettings } from './routes/auth';
import { departmentsRoutes, type DepartmentsDeps } from './routes/departments';
import { healthRoutes } from './routes/health';
import { incidentTypesRoutes, type IncidentTypesDeps } from './routes/incident-types';
import { incidentsRoutes, type IncidentsDeps } from './routes/incidents';
import { usersRoutes, type UserAdminDeps } from './routes/users';

/** Casos de uso de la autenticación y límite de intentos del login. */
export interface AuthDeps {
  login: Login;
  logout: Logout;
  resolveSession: ResolveSession;
  loginRateLimit: LoginRateLimitSettings;
}

export interface AppDeps {
  getHealth: GetHealth;
  auth: AuthDeps;
  /** Casos de uso de la gestión de usuarios (solo Admin). */
  users: UserAdminDeps;
  /** Catálogo de departamentos. */
  departments: DepartmentsDeps;
  /** Catálogo de tipos de incidencia. */
  incidentTypes: IncidentTypesDeps;
  /** Casos de uso de las incidencias. */
  incidents: IncidentsDeps;
  /** Carpeta del build de la web. Si no existe su `index.html` (desarrollo), no se sirve la SPA. */
  webDistDir?: string;
  /** Opciones del logger (pino). Por defecto, sin log (tests). */
  logger?: { level: string; stream?: NodeJS.WritableStream } | false;
  /**
   * Exige HTTPS (HSTS y CSP `upgrade-insecure-requests`). Lo decide `config` (solo en producción).
   * Por defecto, `true`: la configuración más estricta.
   */
  enforceHttps?: boolean;
  /**
   * Saltos de *proxy* de confianza para `request.ip` (`X-Forwarded-For`). Lo decide `config`.
   * Por defecto, 0: no se confía en ninguna cabecera del cliente. Nunca `true` (todos).
   */
  trustProxyHops?: number;
}

const NOT_FOUND_BODY: ErrorResponse = {
  error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
};

/**
 * Lo que nunca se escribe en el log: credenciales de las cabeceras y cualquier `password` de un
 * cuerpo que se registre (CA-01.11). El logger de Fastify no registra cuerpos, pero esto cubre
 * cualquier log futuro que lo haga.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'req.body.password',
];

function loggerOptions(logger: AppDeps['logger']): FastifyServerOptions['logger'] {
  if (!logger) return false;
  return { level: logger.level, stream: logger.stream, redact: REDACTED_PATHS };
}

/**
 * Opciones de Helmet. Con HTTPS, las de por defecto (CSP completa y HSTS). Sin HTTPS (local), la misma CSP
 * sin `upgrade-insecure-requests` y sin HSTS, para que el navegador no fuerce `https://localhost`.
 */
const helmetOptions = (enforceHttps: boolean): FastifyHelmetOptions =>
  enforceHttps
    ? {}
    : {
        contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
        strictTransportSecurity: false,
      };

/** Ruta de cliente de la SPA: no es de la API y su último segmento no parece un archivo (`.js`, `.png`…). */
const isClientRoute = (pathname: string) =>
  !isApiPath(pathname) && !path.posix.basename(pathname).includes('.');

/**
 * `trustProxy` de Fastify para `hops` saltos de *proxy*: se confía en la conexión directa (salto 0,
 * el *proxy* de Render) y en las `hops - 1` entradas siguientes de `X-Forwarded-For`, empezando por
 * el final; `request.ip` es la primera dirección no confiable, la del cliente real. Nunca `true`:
 * con `true` se tomaría la primera IP de la cabecera, que el cliente puede falsear para saltarse el
 * límite de intentos (CA-01.8). Se pasa una función porque Fastify 5.12+ ignora un número
 * (no confía en nada). Supone que la API solo es accesible a través del *proxy*, como en Render.
 */
const trustProxyFor = (hops: number) =>
  hops > 0 ? (_address: string, hop: number) => hop < hops : false;

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const enforceHttps = deps.enforceHttps ?? true;
  const app = Fastify({
    logger: loggerOptions(deps.logger),
    trustProxy: trustProxyFor(deps.trustProxyHops ?? 0),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // Cabeceras de seguridad en todas las respuestas, incluida la CSP por defecto de Helmet.
  await app.register(fastifyHelmet, helmetOptions(enforceHttps));
  await app.register(fastifyCookie);
  // Límite de peticiones solo en las rutas que lo configuran (el login), con almacén en memoria:
  // vale con una sola instancia (plan gratuito de Render).
  await app.register(fastifyRateLimit, { global: false });
  decorateCurrentUser(app);
  // Anti-CSRF global y antes que las rutas: corre antes que el límite de intentos y la validación.
  app.addHook('onRequest', csrfGuard);

  await app.register(healthRoutes({ getHealth: deps.getHealth }), { prefix: API_PREFIX });
  await app.register(authRoutes({ ...deps.auth, cookie: { secure: enforceHttps } }), {
    prefix: API_PREFIX,
  });
  const { resolveSession } = deps.auth;
  await app.register(usersRoutes({ ...deps.users, resolveSession }), { prefix: API_PREFIX });
  await app.register(departmentsRoutes({ ...deps.departments, resolveSession }), {
    prefix: API_PREFIX,
  });
  await app.register(incidentTypesRoutes({ ...deps.incidentTypes, resolveSession }), {
    prefix: API_PREFIX,
  });
  await app.register(incidentsRoutes({ ...deps.incidents, resolveSession }), {
    prefix: API_PREFIX,
  });

  const webDistDir = deps.webDistDir;
  const serveSpa = webDistDir !== undefined && existsSync(path.join(webDistDir, 'index.html'));
  if (serveSpa) {
    // `wildcard: false`: solo se registran rutas para los archivos que existen en el build.
    await app.register(fastifyStatic, { root: webDistDir, wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '/';
    const isRead = request.method === 'GET' || request.method === 'HEAD';
    if (serveSpa && isRead && isClientRoute(pathname)) {
      // Fallback de la SPA: React Router resuelve la ruta en el navegador.
      return reply.status(200).sendFile('index.html');
    }
    return reply.status(404).send(NOT_FOUND_BODY);
  });

  return app;
}
