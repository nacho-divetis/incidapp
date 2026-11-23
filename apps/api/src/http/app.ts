// Construye la aplicación Fastify: seguridad, validación con Zod, rutas de `/api`,
// servicio de la web compilada y respuestas uniformes para lo que no existe.
import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import type { ErrorResponse } from '@incidapp/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { GetHealth } from '../application/health/get-health';
import { errorHandler } from './error-handler';
import { healthRoutes } from './routes/health';

export interface AppDeps {
  getHealth: GetHealth;
  /** Carpeta del build de la web. Si no existe su `index.html` (desarrollo), no se sirve la SPA. */
  webDistDir?: string;
  /** Opciones del logger (pino). Por defecto, sin log (tests). */
  logger?: { level: string; stream?: NodeJS.WritableStream } | false;
}

const API_PREFIX = '/api';

const NOT_FOUND_BODY: ErrorResponse = {
  error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
};

/** Cabeceras que nunca se escriben en el log. */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

function loggerOptions(logger: AppDeps['logger']): FastifyServerOptions['logger'] {
  if (!logger) return false;
  return { level: logger.level, stream: logger.stream, redact: REDACTED_PATHS };
}

const isApiPath = (pathname: string) =>
  pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);

/** Ruta de cliente de la SPA: no es de la API y su último segmento no parece un archivo (`.js`, `.png`…). */
const isClientRoute = (pathname: string) =>
  !isApiPath(pathname) && !path.posix.basename(pathname).includes('.');

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: loggerOptions(deps.logger) });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // Cabeceras de seguridad en todas las respuestas, incluida la CSP por defecto de Helmet.
  await app.register(fastifyHelmet);

  await app.register(healthRoutes({ getHealth: deps.getHealth }), { prefix: API_PREFIX });

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
