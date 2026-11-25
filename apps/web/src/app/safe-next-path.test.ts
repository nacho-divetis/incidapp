import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT_PATH, loginPath, safeNextPath } from './safe-next-path';

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
  ])('rechaza %j y devuelve el listado de incidencias (sin open redirect ni bucles)', (next) => {
    expect(safeNextPath(next)).toBe('/incidencias');
  });

  it('sin `next`, el destino por defecto es el listado de incidencias (CA-07.5)', () => {
    expect(DEFAULT_NEXT_PATH).toBe('/incidencias');
  });
});

describe('loginPath', () => {
  it('sin ruta de vuelta ni aviso, es /login', () => {
    expect(loginPath()).toBe('/login');
    // La página de inicio ya es el destino por defecto: no hace falta en `next`.
    expect(loginPath({ next: '/incidencias' })).toBe('/login');
  });

  it('codifica la ruta de vuelta en `next`', () => {
    expect(loginPath({ next: '/incidencias?estado=OPEN' })).toBe(
      '/login?next=%2Fincidencias%3Festado%3DOPEN',
    );
    expect(loginPath({ next: '/admin/usuarios' })).toBe('/login?next=%2Fadmin%2Fusuarios');
  });

  it('añade `expired=1` para el aviso de sesión caducada', () => {
    expect(loginPath({ next: '/incidencias/abc', expired: true })).toBe(
      '/login?next=%2Fincidencias%2Fabc&expired=1',
    );
    expect(loginPath({ expired: true })).toBe('/login?expired=1');
  });

  it('descarta una ruta de vuelta externa', () => {
    expect(loginPath({ next: '//otro.example' })).toBe('/login');
  });
});
