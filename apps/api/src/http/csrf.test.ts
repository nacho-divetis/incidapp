import { ErrorResponse } from '@incidapp/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CSRF_HEADER_MISSING_MESSAGE, csrfGuard } from './csrf';
import { errorHandler } from './error-handler';

let app: FastifyInstance;

/** Fastify mínimo con el *hook* anti-CSRF, el manejador de errores y rutas de prueba. */
async function appWithGuard(): Promise<FastifyInstance> {
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.addHook('onRequest', csrfGuard);

  const typed = app.withTypeProvider<ZodTypeProvider>();
  // GET registra también HEAD automáticamente.
  for (const method of ['GET', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    typed.route({ method, url: '/api/recurso', handler: async () => ({ ok: true }) });
  }
  typed.post(
    '/api/validado',
    { schema: { body: z.object({ title: z.string().min(1) }) } },
    async () => ({ ok: true }),
  );
  typed.post('/fuera-de-la-api', async () => ({ ok: true }));
  await app.ready();
  return app;
}

afterEach(async () => {
  await app.close();
});

const FORBIDDEN_BODY: ErrorResponse = {
  error: { code: 'FORBIDDEN', message: CSRF_HEADER_MISSING_MESSAGE },
};

describe('csrfGuard', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'CA-01.10: %s a /api sin X-Requested-With responde 403 con ErrorResponse en español',
    async (method) => {
      await appWithGuard();

      const response = await app.inject({ method, url: '/api/recurso' });

      expect(response.statusCode).toBe(403);
      expect(ErrorResponse.parse(response.json())).toEqual(FORBIDDEN_BODY);
      expect(CSRF_HEADER_MISSING_MESSAGE).toMatch(/X-Requested-With/);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'CA-01.10: %s a /api con X-Requested-With sigue su curso normal',
    async (method) => {
      await appWithGuard();

      const response = await app.inject({
        method,
        url: '/api/recurso',
        headers: { 'x-requested-with': 'fetch' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    },
  );

  it.each(['GET', 'HEAD', 'OPTIONS'] as const)(
    'CA-01.10: %s no necesita la cabecera',
    async (method) => {
      await appWithGuard();

      const response = await app.inject({ method, url: '/api/recurso' });

      expect(response.statusCode).toBe(200);
    },
  );

  it('CA-01.10: una cabecera X-Requested-With vacía cuenta como ausente', async () => {
    await appWithGuard();

    const response = await app.inject({
      method: 'POST',
      url: '/api/recurso',
      headers: { 'x-requested-with': '' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('CA-01.10: sin la cabecera responde 403 antes de validar el cuerpo (no 400)', async () => {
    await appWithGuard();

    const response = await app.inject({
      method: 'POST',
      url: '/api/validado',
      payload: { title: '' },
    });

    expect(response.statusCode).toBe(403);
    expect(ErrorResponse.parse(response.json())).toEqual(FORBIDDEN_BODY);
  });

  it('CA-01.10: con la cabecera, el cuerpo se valida como siempre (400)', async () => {
    await appWithGuard();

    const response = await app.inject({
      method: 'POST',
      url: '/api/validado',
      headers: { 'x-requested-with': 'fetch' },
      payload: { title: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('CA-01.10: una ruta /api escrita con caracteres codificados (/%61pi/…) no se salta la comprobación', async () => {
    await appWithGuard();

    // El router de Fastify decodifica la ruta: `/%61pi/recurso` llega a la ruta `/api/recurso`.
    const response = await app.inject({ method: 'POST', url: '/%61pi/recurso' });

    expect(response.statusCode).toBe(403);
    expect(ErrorResponse.parse(response.json())).toEqual(FORBIDDEN_BODY);
  });

  it('CA-01.10: fuera de /api no se exige la cabecera', async () => {
    await appWithGuard();

    const response = await app.inject({ method: 'POST', url: '/fuera-de-la-api' });

    expect(response.statusCode).toBe(200);
  });
});
