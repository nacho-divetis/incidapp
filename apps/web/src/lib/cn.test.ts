import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('une clases y descarta las condiciones falsas', () => {
    expect(cn('px-2', false, null, undefined, { 'font-medium': true, italic: false })).toBe(
      'px-2 font-medium',
    );
  });

  it('resuelve los conflictos de Tailwind dejando la última clase', () => {
    expect(cn('p-2 text-fg', 'p-4')).toBe('text-fg p-4');
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg');
  });

  it('distingue los colores semánticos de los tamaños de texto', () => {
    expect(cn('text-sm text-fg', 'text-danger-fg')).toBe('text-sm text-danger-fg');
  });
});
