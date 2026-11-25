// CA-02.18: listado de usuarios con `fetch` simulado (rutas y providers reales).
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_ADMIN, errorResponse, jsonResponse, mockApi, never } from '../../test/api-mock';
import { renderApp } from '../../test/render-app';
import { DEMO_MANAGER, LUCIA, deactivated } from '../../test/user-fixtures';

const ME = 'GET /api/auth/me';
const USERS = 'GET /api/users';

describe('CA-02.18 · listado de usuarios', () => {
  it('mientras carga muestra un indicador', async () => {
    mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), [USERS]: never });

    renderApp('/admin/usuarios');

    expect(await screen.findByText('Cargando usuarios…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra la tabla con cabeceras, rol en español, departamentos, estado y acceso a editar', async () => {
    const inactive = deactivated(DEMO_MANAGER);
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [USERS]: () => jsonResponse(200, [LUCIA, inactive]),
    });

    renderApp('/admin/usuarios');

    const table = await screen.findByRole('table', { name: 'Usuarios' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Nombre', 'Email', 'Rol', 'Departamentos', 'Estado']);

    const [, luciaRow, carmenRow] = within(table).getAllByRole('row');
    expect(within(luciaRow!).getByRole('link', { name: 'Lucía Gil' })).toHaveAttribute(
      'href',
      `/admin/usuarios/${LUCIA.id}`,
    );
    expect(luciaRow).toHaveTextContent(LUCIA.email);
    expect(luciaRow).toHaveTextContent('Responsable');
    expect(luciaRow).toHaveTextContent('Logística');
    expect(luciaRow).toHaveTextContent('Mantenimiento');
    expect(luciaRow).toHaveTextContent('Activo');
    expect(carmenRow).toHaveTextContent('Desactivado');
  });

  it('tiene el botón "Nuevo usuario" que lleva al alta', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [USERS]: () => jsonResponse(200, [LUCIA]),
      'GET /api/departments': never,
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/admin/usuarios');

    await user.click(await screen.findByRole('link', { name: 'Nuevo usuario' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nuevo usuario' }),
    ).toBeInTheDocument();
    expect(currentPath()).toBe('/admin/usuarios/nuevo');
  });

  it('sin usuarios muestra el estado vacío', async () => {
    mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), [USERS]: () => jsonResponse(200, []) });

    renderApp('/admin/usuarios');

    expect(await screen.findByText('Todavía no hay usuarios.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('si la API falla, muestra un `Alert` con el mensaje en español', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [USERS]: () => errorResponse(403, 'FORBIDDEN', 'No tienes permiso para hacer esto.'),
    });

    renderApp('/admin/usuarios');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para hacer esto.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el aviso de éxito que llega en `location.state` y lo quita del historial', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [USERS]: () => jsonResponse(200, []),
      'GET /api/health': never,
    });
    const { router } = renderApp('/');
    await act(() =>
      router.navigate('/admin/usuarios', { state: { notice: 'Usuario Lucía Gil creado.' } }),
    );

    expect(await screen.findByText('Todavía no hay usuarios.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Usuario Lucía Gil creado.');
    expect(router.state.location.state).toBeNull();
  });

  it('ignora un estado de navegación que no es un aviso', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      [USERS]: () => jsonResponse(200, []),
      'GET /api/health': never,
    });
    const { router } = renderApp('/');

    await act(() => router.navigate('/admin/usuarios', { state: { notice: 42 } }));

    expect(await screen.findByText('Todavía no hay usuarios.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
