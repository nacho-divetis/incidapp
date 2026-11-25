import { describe, expect, it } from 'vitest';
import { noticeOf } from './location-notice';

describe('noticeOf', () => {
  it('devuelve el aviso de un estado con la forma esperada', () => {
    expect(noticeOf({ notice: 'Incidencia creada.' })).toBe('Incidencia creada.');
  });

  it.each([null, undefined, 'texto', {}, { notice: '' }, { notice: 42 }])(
    'ignora un estado sin aviso válido (%j)',
    (state) => {
      expect(noticeOf(state)).toBeUndefined();
    },
  );
});
