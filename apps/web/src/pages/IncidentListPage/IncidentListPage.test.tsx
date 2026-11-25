// CA-03.12 (listado, filtros, paginación, vacío, carga y error) y el botón de CA-03.13, con `fetch`
// simulado (rutas y providers reales).
import type { CurrentUser, IncidentListResponse } from '@incidapp/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DEMO_ADMIN,
  DEMO_USER,
  errorResponse,
  jsonResponse,
  mockApi,
  never,
} from '../../test/api-mock';
import {
  INCIDENT,
  INCIDENT_DEPARTMENTS,
  INCIDENT_DEPARTMENT_LIST,
  INCIDENT_LIST_ITEMS,
} from '../../test/incident-fixtures';
import { renderApp } from '../../test/render-app';

const ME = 'GET /api/auth/me';
const FIRST_PAGE = 'GET /api/incidents?page=1';

/** Dirección: puede ver todo, pero no tiene `createIncident`. */
const DIRECTOR: CurrentUser = {
  ...DEMO_USER,
  role: 'DIRECTOR',
  allowedActions: ['viewDashboard', 'viewAudit'],
};

function listOf(overrides: Partial<IncidentListResponse> = {}): IncidentListResponse {
  return { items: INCIDENT_LIST_ITEMS, total: 3, page: 1, pageSize: 20, ...overrides };
}

function setupApi(user: CurrentUser = DEMO_USER, firstPage = listOf()) {
  return mockApi({
    [ME]: () => jsonResponse(200, user),
    'GET /api/departments': () => jsonResponse(200, INCIDENT_DEPARTMENT_LIST),
    [FIRST_PAGE]: () => jsonResponse(200, firstPage),
  });
}

/** Peticiones al listado, en orden (solo la *query string*). */
function listRequests(api: ReturnType<typeof mockApi>) {
  return api.requests
    .filter((request) => request.method === 'GET' && request.path.startsWith('/api/incidents?'))
    .map((request) => request.path.replace('/api/incidents?', ''));
}

const table = () => screen.findByRole('table', { name: 'Incidencias' });

describe('CA-03.12 · listado de incidencias', () => {
  it('"Incidencias" está en la navegación y lleva al listado', async () => {
    const api = setupApi();
    api.on('GET /api/health', never); // la página de inicio pide la salud de la API
    const user = userEvent.setup();
    const { currentPath } = renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
    await user.click(within(nav).getByRole('link', { name: 'Incidencias' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Incidencias' })).toBeVisible();
    expect(currentPath()).toBe('/incidencias');
    expect(within(nav).getByRole('link', { name: 'Incidencias' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('muestra la tabla con las columnas, los enlaces al detalle y el total', async () => {
    setupApi();

    renderApp('/incidencias');

    const rows = within(await table()).getAllByRole('row');
    expect(rows).toHaveLength(1 + INCIDENT_LIST_ITEMS.length);
    expect(screen.getByRole('link', { name: INCIDENT.code })).toHaveAttribute(
      'href',
      `/incidencias/${INCIDENT.id}`,
    );
    const firstRow = rows[1] as HTMLElement;
    expect(within(firstRow).getByText('Alta')).toBeInTheDocument();
    expect(within(firstRow).getByText('Abierta')).toBeInTheDocument();
    expect(within(firstRow).getByText('30/11/2026')).toBeInTheDocument();
    const pagination = screen.getByRole('navigation', { name: 'Paginación de incidencias' });
    expect(pagination).toHaveTextContent('3 resultados · Página 1 de 1');
  });

  it('mientras carga muestra un indicador', async () => {
    mockApi({
      [ME]: () => jsonResponse(200, DEMO_USER),
      'GET /api/departments': () => jsonResponse(200, INCIDENT_DEPARTMENT_LIST),
      [FIRST_PAGE]: never,
    });

    renderApp('/incidencias');

    expect(await screen.findByText('Cargando incidencias…')).toBeInTheDocument();
  });

  it('si la API falla, muestra un aviso con el mensaje en español', async () => {
    const api = setupApi();
    api.on(FIRST_PAGE, () => errorResponse(400, 'VALIDATION', 'La página no es válida.'));

    renderApp('/incidencias');

    expect(await screen.findByRole('alert')).toHaveTextContent('La página no es válida.');
  });

  it('sin resultados muestra el estado vacío y no la paginación', async () => {
    setupApi(DEMO_USER, listOf({ items: [], total: 0 }));

    renderApp('/incidencias');

    expect(
      await screen.findByText('No hay incidencias que coincidan con los filtros.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación de incidencias' })).toBeNull();
  });

  it('"Siguiente" pide la página 2', async () => {
    const api = setupApi(DEMO_USER, listOf({ total: 45 }));
    api.on('GET /api/incidents?page=2', () =>
      jsonResponse(200, listOf({ total: 45, page: 2, items: INCIDENT_LIST_ITEMS.slice(2) })),
    );
    const user = userEvent.setup();
    renderApp('/incidencias');
    await table();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('45 resultados · Página 2 de 3')).toBeInTheDocument();
    expect(within(await table()).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  it('cambiar un filtro pide la página 1 con los filtros combinados', async () => {
    const api = setupApi(DEMO_USER, listOf({ total: 45 }));
    api.on('GET /api/incidents?page=2', () => jsonResponse(200, listOf({ total: 45, page: 2 })));
    const statusRoute = 'GET /api/incidents?status=IN_PROGRESS&page=1';
    api.on(statusRoute, () =>
      jsonResponse(200, listOf({ items: INCIDENT_LIST_ITEMS.slice(1, 2), total: 1 })),
    );
    const combined = `GET /api/incidents?status=IN_PROGRESS&departmentId=${INCIDENT_DEPARTMENTS.ATC.id}&assignedToMe=true&page=1`;
    api.on(combined, () => jsonResponse(200, listOf({ items: [], total: 0 })));
    const user = userEvent.setup();
    renderApp('/incidencias');
    await table();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('45 resultados · Página 2 de 3');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'IN_PROGRESS');

    expect(await screen.findByText('1 resultado · Página 1 de 1')).toBeInTheDocument();
    expect(api.callsTo(statusRoute)).toHaveLength(1);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Departamento' }),
      INCIDENT_DEPARTMENTS.ATC.id,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Asignadas a mí' }));

    expect(
      await screen.findByText('No hay incidencias que coincidan con los filtros.'),
    ).toBeInTheDocument();
    expect(api.callsTo(combined)).toHaveLength(1);
  });

  it('el buscador espera a que se deje de escribir: una sola petición con el texto', async () => {
    const api = setupApi();
    const searchRoute = 'GET /api/incidents?q=pal%C3%A9&page=1';
    api.on(searchRoute, () =>
      jsonResponse(200, listOf({ items: INCIDENT_LIST_ITEMS.slice(0, 1), total: 1 })),
    );
    const user = userEvent.setup();
    renderApp('/incidencias');
    await table();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'palé');

    expect(await screen.findByText('1 resultado · Página 1 de 1')).toBeInTheDocument();
    expect(listRequests(api)).toEqual(['page=1', 'q=pal%C3%A9&page=1']);
  });

  it('buscar desde la página 3 hace una sola petición nueva: el texto en la página 1', async () => {
    const api = setupApi(DEMO_USER, listOf({ total: 45 }));
    api.on('GET /api/incidents?page=2', () => jsonResponse(200, listOf({ total: 45, page: 2 })));
    api.on('GET /api/incidents?page=3', () =>
      jsonResponse(200, listOf({ total: 45, page: 3, items: INCIDENT_LIST_ITEMS.slice(0, 1) })),
    );
    api.on('GET /api/incidents?q=pal%C3%A9&page=1', () =>
      jsonResponse(200, listOf({ items: INCIDENT_LIST_ITEMS.slice(0, 1), total: 1 })),
    );
    const user = userEvent.setup();
    renderApp('/incidencias');
    await table();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('45 resultados · Página 2 de 3');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('45 resultados · Página 3 de 3');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'palé');

    expect(await screen.findByText('1 resultado · Página 1 de 1')).toBeInTheDocument();
    expect(listRequests(api)).toEqual(['page=1', 'page=2', 'page=3', 'q=pal%C3%A9&page=1']);
  });

  it.each([
    ['un Usuario con `createIncident`', DEMO_USER, true],
    ['Dirección, sin `createIncident`', DIRECTOR, false],
    // Datos imposibles a propósito: decide `allowedActions`, no el rol.
    ['un Admin sin `createIncident`', { ...DEMO_ADMIN, allowedActions: ['manageUsers'] }, false],
  ] as const)('"Nueva incidencia" con %s: %s', async (_name, user, visible) => {
    setupApi(user as CurrentUser);

    renderApp('/incidencias');

    await table();
    const create = screen.queryByRole('link', { name: 'Nueva incidencia' });
    if (visible) expect(create).toHaveAttribute('href', '/incidencias/nueva');
    else expect(create).not.toBeInTheDocument();
  });
});
