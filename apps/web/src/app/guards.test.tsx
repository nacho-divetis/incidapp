// CA-02.17: `RequireAction` pinta "No tienes permiso" sin montar la página ni pedir datos.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_ADMIN, DEMO_USER, jsonResponse, mockApi, never } from '../test/api-mock';
import { renderApp } from '../test/render-app';

const ME = 'GET /api/auth/me';

describe('CA-02.17 · página sin permiso', () => {
  it.each([
    '/admin/usuarios',
    '/admin/usuarios/nuevo',
    '/admin/usuarios/3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a',
  ])('sin `manageUsers`, %s muestra "No tienes permiso" sin pedir datos a la API', async (path) => {
    const api = mockApi({ [ME]: () => jsonResponse(200, DEMO_USER) });

    const { currentPath } = renderApp(path);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'No tienes permiso para ver esta página.',
      }),
    ).toBeInTheDocument();
    expect(currentPath()).toBe(path);
    // Solo se ha pedido la sesión: ni `/api/users` ni `/api/departments`.
    expect(api.requests.map((request) => `${request.method} ${request.path}`)).toEqual([ME]);
    // La cabecera y la navegación siguen ahí (va dentro de `AppLayout`).
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
  });

  it('el enlace lleva a la página de inicio (el listado de incidencias)', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_USER),
      'GET /api/incidents?page=1': never,
      'GET /api/departments': never,
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/admin/usuarios');

    const main = await screen.findByRole('main');
    await user.click(within(main).getByRole('link', { name: 'Volver a la página de inicio' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Incidencias' }),
    ).toBeInTheDocument();
    expect(currentPath()).toBe('/incidencias');
  });

  it('con `manageUsers`, monta la página (que pide sus datos)', async () => {
    const api = mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), 'GET /api/users': never });

    renderApp('/admin/usuarios');

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(api.callsTo('GET /api/users')).toHaveLength(1);
    expect(screen.queryByText('No tienes permiso para ver esta página.')).not.toBeInTheDocument();
  });
});
