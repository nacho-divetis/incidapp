// Archivo aparte a propósito: no importa ningún valor de `@incidapp/shared` (solo tipos, que desaparecen
// al compilar). Así se comprueba que es `buildApp` quien deja Zod configurado en español, y no el test.
import type { ErrorResponse } from '@incidapp/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { GetHealth } from '../application/health/get-health';
import { buildApp } from './app';
import { unusedAuth } from './test-support';

const getHealth: GetHealth = async () => ({ status: 'ok', db: 'ok', version: '0.1.0' });

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('buildApp · mensajes de validación', () => {
  it('CA-00.5: los detalles de un 400 por validación del esquema Zod están en español', async () => {
    app = await buildApp({ auth: unusedAuth, getHealth });
    // Ruta de prueba con validación del cuerpo, como las que añadirán las features.
    app
      .withTypeProvider<ZodTypeProvider>()
      .post(
        '/api/validated',
        { schema: { body: z.object({ title: z.string().min(1), tags: z.array(z.string()) }) } },
        async () => ({ ok: true }),
      );

    const response = await app.inject({
      method: 'POST',
      url: '/api/validated',
      // Cabecera anti-CSRF obligatoria en los POST a /api (CA-01.10).
      headers: { 'x-requested-with': 'fetch' },
      payload: { title: '', tags: [1] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ErrorResponse>()).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'Los datos enviados no son válidos.',
        details: [
          {
            path: 'title',
            message: 'Demasiado pequeño: se esperaba que texto tuviera >=1 caracteres',
          },
          { path: 'tags.0', message: 'Entrada inválida: se esperaba texto, recibido número' },
        ],
      },
    });
  });
});
