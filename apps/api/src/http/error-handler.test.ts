import { ErrorResponse } from '@incidapp/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../application/errors';
import { errorHandler, TooManyRequestsError } from './error-handler';

let app: FastifyInstance;

/** Fastify mínimo con el manejador de errores y una ruta que lanza `error`. */
async function appThrowing(error: unknown): Promise<FastifyInstance> {
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.get('/boom', async () => {
    throw error;
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/validated',
      { schema: { body: z.object({ title: z.string().min(1), tags: z.array(z.string()) }) } },
      async () => ({ ok: true }),
    );
  await app.ready();
  return app;
}

afterEach(async () => {
  await app.close();
});

describe('errorHandler', () => {
  it.each([
    [new ValidationError('El título es obligatorio.'), 400, 'VALIDATION'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError(), 409, 'CONFLICT'],
  ] as const)(
    'CA-00.5: %s se responde con %i y ErrorResponse con código %s',
    async (error, status, code) => {
      await appThrowing(error);

      const response = await app.inject({ method: 'GET', url: '/boom' });

      expect(response.statusCode).toBe(status);
      expect(response.headers['content-type']).toContain('application/json');
      const body = ErrorResponse.parse(response.json());
      expect(body.error.code).toBe(code);
      expect(body.error.message).toBe(error.message);
    },
  );

  it('CA-00.5: los mensajes por defecto de los errores tipados están en español', () => {
    expect(new NotFoundError().message).toBe('El recurso solicitado no existe.');
    expect(new ForbiddenError().message).toBe('No tienes permiso para realizar esta acción.');
    expect(new ConflictError().message).toBe(
      'La operación entra en conflicto con el estado actual.',
    );
    expect(new ValidationError().message).toBe('Los datos enviados no son válidos.');
    expect(new UnauthorizedError().message).toBe('Debes iniciar sesión.');
  });

  it('CA-00.5: ValidationError incluye los detalles por campo', async () => {
    await appThrowing(
      new ValidationError(undefined, [{ path: 'title', message: 'El título es obligatorio.' }]),
    );

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(400);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'Los datos enviados no son válidos.',
        details: [{ path: 'title', message: 'El título es obligatorio.' }],
      },
    });
  });

  it('CA-00.5: un fallo de validación del esquema Zod responde 400 con los campos afectados', async () => {
    await appThrowing(new Error('no se usa'));

    const response = await app.inject({
      method: 'POST',
      url: '/validated',
      payload: { title: '', tags: [1] },
    });

    expect(response.statusCode).toBe(400);
    const body = ErrorResponse.parse(response.json());
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.message).toBe('Los datos enviados no son válidos.');
    expect(body.error.details?.map((detail) => detail.path)).toEqual(['title', 'tags.0']);
  });

  it('CA-00.5: un cuerpo JSON mal formado responde 400 con un mensaje genérico en español', async () => {
    await appThrowing(new Error('no se usa'));

    const response = await app.inject({
      method: 'POST',
      url: '/validated',
      headers: { 'content-type': 'application/json' },
      payload: '{"title":',
    });

    expect(response.statusCode).toBe(400);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: { code: 'VALIDATION', message: 'La petición no es válida.' },
    });
  });

  it('CA-00.5: un error no previsto responde 500 con un mensaje genérico, sin stack, SQL ni rutas', async () => {
    const internal = new Error(
      'relation "users" does not exist: select * from users at /srv/incidapp/apps/api/src/x.ts',
    );
    await appThrowing(internal);

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: { code: 'INTERNAL', message: 'Se ha producido un error inesperado.' },
    });
    expect(response.body).not.toMatch(/relation|select|users|\.ts|stack|at /i);
  });

  it('CA-00.5: un valor lanzado que no es un Error también responde 500 genérico', async () => {
    await appThrowing('cadena lanzada');

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(ErrorResponse.parse(response.json()).error.code).toBe('INTERNAL');
  });

  it('CA-01.8: TooManyRequestsError responde 429 TOO_MANY_REQUESTS con su mensaje en español', async () => {
    await appThrowing(new TooManyRequestsError('Demasiados intentos. Espera un poco.'));

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(429);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Espera un poco.' },
    });
  });

  it('CA-01.8: cualquier otro error con statusCode 429 responde TOO_MANY_REQUESTS con un mensaje genérico en español', async () => {
    const error = Object.assign(new Error('Rate limit exceeded, retry in 1 minute'), {
      statusCode: 429,
    });
    await appThrowing(error);

    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(429);
    expect(ErrorResponse.parse(response.json())).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.',
      },
    });
  });
});
