import { describe, expect, it } from 'vitest';
import { loginPath, safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it.each(['/', '/incidencias', '/incidencias/abc?estado=OPEN#historial', '/a/b/../c'])(
    'acepta la ruta interna %s',
    (next) => {
      expect(safeNextPath(next)).toBe(next);
    },
  );

  it.each([
    [null],
    [undefined],
    [''],
    ['incidencias'],
    ['https://otro.example/'],
    ['//otro.example/ruta'],
    ['/\\otro.example'],
    ['\\\\otro.example'],
    ['/\t/otro.example'],
    ['/\n/otro.example'],
    ['javascript:alert(1)'],
    ['/login'],
    ['/login?next=/incidencias'],
  ])('rechaza %j y devuelve "/" (sin open redirect ni bucles)', (next) => {
    expect(safeNextPath(next)).toBe('/');
  });
});

describe('loginPath', () => {
  it('sin ruta de vuelta ni aviso, es /login', () => {
    expect(loginPath()).toBe('/login');
    expect(loginPath({ next: '/' })).toBe('/login');
  });

  it('codifica la ruta de vuelta en `next`', () => {
    expect(loginPath({ next: '/incidencias?estado=OPEN' })).toBe(
      '/login?next=%2Fincidencias%3Festado%3DOPEN',
    );
  });

  it('añade `expired=1` para el aviso de sesión caducada', () => {
    expect(loginPath({ next: '/incidencias', expired: true })).toBe(
      '/login?next=%2Fincidencias&expired=1',
    );
    expect(loginPath({ expired: true })).toBe('/login?expired=1');
  });

  it('descarta una ruta de vuelta externa', () => {
    expect(loginPath({ next: '//otro.example' })).toBe('/login');
  });
});
