// CA-02.3: de la política al error de aplicación (`permisos.md` → Respuestas de la API).
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError } from '../errors';
import { authorize } from './authorize';

describe('CA-02.3: authorize', () => {
  it('CA-02.3: si el recurso no es visible lanza NotFoundError (404) con el mensaje en español', () => {
    expect(() => authorize({ visible: false, allowed: false })).toThrow(NotFoundError);
    expect(() => authorize({ visible: false, allowed: false })).toThrow(
      'El recurso solicitado no existe.',
    );
  });

  it('CA-02.3: no visible gana a permitido: nunca revela que el recurso existe', () => {
    expect(() => authorize({ visible: false, allowed: true })).toThrow(NotFoundError);
  });

  it('CA-02.3: si es visible pero la acción no está permitida lanza ForbiddenError (403) en español', () => {
    expect(() => authorize({ visible: true, allowed: false })).toThrow(ForbiddenError);
    expect(() => authorize({ visible: true, allowed: false })).toThrow(
      'No tienes permiso para realizar esta acción.',
    );
  });

  it('CA-02.3: si es visible y está permitida no lanza nada', () => {
    expect(() => authorize({ visible: true, allowed: true })).not.toThrow();
  });
});
