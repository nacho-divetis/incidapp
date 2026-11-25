// CA-02.16: la navegación depende solo de `allowedActions` y marca la página actual.
import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav-items';

const labels = (items: ReturnType<typeof navItemsFor>) => items.map((item) => item.label);
const current = (items: ReturnType<typeof navItemsFor>) =>
  items.filter((item) => item.current).map((item) => item.label);

describe('navItemsFor', () => {
  it('con `manageUsers` muestra "Inicio" y "Usuarios"', () => {
    expect(labels(navItemsFor(['createIncident', 'manageUsers'], '/'))).toEqual([
      'Inicio',
      'Usuarios',
    ]);
  });

  it('sin `manageUsers` solo muestra "Inicio"', () => {
    expect(labels(navItemsFor(['createIncident', 'viewDashboard', 'viewAudit'], '/'))).toEqual([
      'Inicio',
    ]);
    expect(labels(navItemsFor([], '/'))).toEqual(['Inicio']);
  });

  it('los destinos son los de las rutas', () => {
    expect(navItemsFor(['manageUsers'], '/').map((item) => item.href)).toEqual([
      '/',
      '/admin/usuarios',
    ]);
  });

  it.each([
    ['/', ['Inicio']],
    ['/admin/usuarios', ['Usuarios']],
    ['/admin/usuarios/nuevo', ['Usuarios']],
    ['/admin/usuarios/3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a', ['Usuarios']],
    ['/admin/usuariosx', []],
    ['/otra', []],
  ])('en %s el enlace actual es %j', (pathname, expected) => {
    expect(current(navItemsFor(['manageUsers'], pathname))).toEqual(expected);
  });
});
