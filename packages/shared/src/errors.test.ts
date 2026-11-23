import { describe, expect, it } from 'vitest';
import { ErrorCode, ErrorResponse } from './index';

describe('ErrorResponse', () => {
  it('CA-00.5, CA-01.8: define los códigos de error del contrato, incluido el del límite de intentos', () => {
    expect(ErrorCode.options).toEqual([
      'VALIDATION',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'TOO_MANY_REQUESTS',
      'INTERNAL',
    ]);
  });

  it.each(ErrorCode.options)('CA-00.5: acepta un error con el código %s', (code) => {
    const body = { error: { code, message: 'Mensaje en español.' } };
    expect(ErrorResponse.parse(body)).toEqual(body);
  });

  it('CA-00.5: acepta los detalles de validación por campo', () => {
    const body = {
      error: {
        code: 'VALIDATION',
        message: 'Los datos no son válidos.',
        details: [{ path: 'title', message: 'El título es obligatorio.' }],
      },
    };
    expect(ErrorResponse.parse(body)).toEqual(body);
  });

  it.each([
    ['un código desconocido', { error: { code: 'TEAPOT', message: 'Soy una tetera.' } }],
    ['un mensaje vacío', { error: { code: 'INTERNAL', message: '' } }],
    ['sin el objeto error', { code: 'INTERNAL', message: 'Error.' }],
    [
      'detalles sin ruta',
      { error: { code: 'VALIDATION', message: 'Error.', details: [{ message: 'Falta' }] } },
    ],
  ])('CA-00.5: rechaza %s', (_case, body) => {
    expect(ErrorResponse.safeParse(body).success).toBe(false);
  });
});
