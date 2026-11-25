// CA-02.16: la navegación de `AppLayout` según `allowedActions`, con la página actual marcada.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '@incidapp/shared';
import { DEMO_ADMIN, DEMO_USER, jsonResponse, mockApi, never } from '../test/api-mock';
import { renderApp } from '../test/render-app';

const ME = 'GET /api/auth/me';
// Lo que pide el listado de incidencias (la página de inicio) al montarse.
const LIST_PENDING = { 'GET /api/incidents?page=1': never, 'GET /api/departments': never };

function navigation() {
  return screen.findByRole('navigation', { name: 'Navegación principal' });
}

describe('CA-02.16 · navegación según las acciones permitidas', () => {
  it('con `manageUsers` muestra "Incidencias" y "Usuarios", con la página actual marcada', async () => {
    mockApi({ [ME]: () => jsonResponse(200, DEMO_ADMIN), ...LIST_PENDING });

    renderApp('/incidencias');

    const nav = await navigation();
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Incidencias', 'Usuarios']);
    expect(within(nav).getByRole('link', { name: 'Incidencias' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Usuarios' })).not.toHaveAttribute('aria-current');
  });

  it('sin `manageUsers` muestra solo "Incidencias"', async () => {
    mockApi({ [ME]: () => jsonResponse(200, DEMO_USER), ...LIST_PENDING });

    renderApp('/incidencias');

    const nav = await navigation();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Incidencias']);
  });

  it('decide por `allowedActions`, no por el rol', async () => {
    // Datos imposibles a propósito: un Admin sin `manageUsers` y un Usuario con ella.
    const adminWithout: CurrentUser = { ...DEMO_ADMIN, allowedActions: ['createIncident'] };
    const api = mockApi({ [ME]: () => jsonResponse(200, adminWithout), ...LIST_PENDING });
    const first = renderApp('/incidencias');
    expect(
      within(await navigation())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Incidencias']);
    first.unmount();

    api.on(ME, () => jsonResponse(200, { ...DEMO_USER, allowedActions: ['manageUsers'] }));
    renderApp('/incidencias');
    expect(
      within(await navigation())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Incidencias', 'Usuarios']);
  });

  it('navega a "Usuarios" y la marca como actual', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_ADMIN),
      ...LIST_PENDING,
      'GET /api/users': never,
    });
    const user = userEvent.setup();
    const { currentPath } = renderApp('/incidencias');

    await user.click(within(await navigation()).getByRole('link', { name: 'Usuarios' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(currentPath()).toBe('/admin/usuarios');
    const nav = await navigation();
    expect(within(nav).getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Incidencias' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
