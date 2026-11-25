import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { NETWORK_ERROR_MESSAGE, errorMessageOf, formErrorsOf } from './error-messages';

const FIELDS = ['email', 'departmentIds'] as const;

describe('errorMessageOf', () => {
  it('usa el mensaje de la API', () => {
    expect(errorMessageOf(new ApiError(403, 'FORBIDDEN', 'No tienes permiso.'))).toBe(
      'No tienes permiso.',
    );
  });

  it('sin respuesta de la API, da el mensaje de conexión', () => {
    expect(errorMessageOf(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE);
  });
});

describe('formErrorsOf', () => {
  it('sin error, no hay errores', () => {
    expect(formErrorsOf(null, FIELDS)).toEqual({});
  });

  it('un 400 con detalles de campos conocidos va a esos campos', () => {
    const error = new ApiError(400, 'VALIDATION', 'Los datos enviados no son válidos.', [
      { path: 'departmentIds', message: 'Algún departamento no existe.' },
      { path: 'departmentIds.1', message: 'Otro mensaje.' },
    ]);

    expect(formErrorsOf(error, FIELDS)).toEqual({
      fieldErrors: { departmentIds: 'Algún departamento no existe.' },
      message: undefined,
    });
  });

  it('los detalles de campos desconocidos van al mensaje general', () => {
    const error = new ApiError(400, 'VALIDATION', 'Los datos enviados no son válidos.', [
      { path: 'email', message: 'El email no es válido.' },
      { path: 'otro', message: 'No válido.' },
    ]);

    expect(formErrorsOf(error, FIELDS)).toEqual({
      fieldErrors: { email: 'El email no es válido.' },
      message: 'Los datos enviados no son válidos.',
    });
  });

  it('otro error va al mensaje general', () => {
    expect(formErrorsOf(new ApiError(500, 'INTERNAL', 'Error.'), FIELDS)).toEqual({
      message: 'Error.',
    });
    expect(formErrorsOf(new TypeError('Failed to fetch'), FIELDS)).toEqual({
      message: NETWORK_ERROR_MESSAGE,
    });
  });
});
