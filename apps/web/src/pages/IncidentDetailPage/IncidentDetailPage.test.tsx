// CA-03.14 (detalle) y la asignación de CA-03.15, con `fetch` simulado (rutas y providers reales).
import type { Incident } from '@incidapp/shared';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_USER, errorResponse, jsonResponse, mockApi, never } from '../../test/api-mock';
import { INCIDENT, PEOPLE, UNASSIGNED_INCIDENT } from '../../test/incident-fixtures';
import { renderApp } from '../../test/render-app';

const ME = 'GET /api/auth/me';
const DETAIL = `GET /api/incidents/${INCIDENT.id}`;
const ASSIGNEES = `GET /api/incidents/${INCIDENT.id}/assignees`;
const ASSIGN = `POST /api/incidents/${INCIDENT.id}/assign`;
const DETAIL_PATH = `/incidencias/${INCIDENT.id}`;

function setupApi(incident: Incident = INCIDENT) {
  return mockApi({
    [ME]: () => jsonResponse(200, DEMO_USER),
    [DETAIL]: () => jsonResponse(200, incident),
    [ASSIGNEES]: () => jsonResponse(200, [PEOPLE.LUIS, PEOPLE.MARTA, PEOPLE.PABLO]),
  });
}

const title = () => screen.findByRole('heading', { level: 1, name: INCIDENT.title });
const assignSection = () => screen.findByRole('region', { name: 'Asignación' });

describe('CA-03.14 · detalle de una incidencia', () => {
  it('mientras carga muestra un indicador', async () => {
    const api = setupApi();
    api.on(DETAIL, never);

    renderApp(DETAIL_PATH);

    expect(await screen.findByText('Cargando la incidencia…')).toBeInTheDocument();
  });

  it('muestra los datos de la incidencia con las fechas en dd/mm/aaaa', async () => {
    setupApi();

    renderApp(DETAIL_PATH);

    await title();
    expect(screen.getByText(INCIDENT.code)).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
    expect(screen.getByText('Logística y Almacén (LOG)')).toBeInTheDocument();
    expect(screen.getByText(PEOPLE.LUIS.name)).toBeInTheDocument();
    expect(screen.getByText('30/11/2026')).toBeInTheDocument();
    expect(screen.getAllByText('24/11/2026')).toHaveLength(2); // creación y actualización
    expect(screen.getByText(/El palé 3 del pedido 4512/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al listado de incidencias' })).toHaveAttribute(
      'href',
      '/incidencias',
    );
  });

  it('con `update` y `assign` muestra "Editar" y el control de asignación', async () => {
    setupApi();

    renderApp(DETAIL_PATH);

    await title();
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      `${DETAIL_PATH}/editar`,
    );
    const section = await assignSection();
    const select = await within(section).findByRole('combobox', { name: 'Asignar a' });
    await waitFor(() => expect(select).toHaveValue(PEOPLE.MARTA.id));
  });

  it('sin acciones no muestra "Editar" ni la asignación, ni pide los candidatos', async () => {
    const api = setupApi(UNASSIGNED_INCIDENT);

    renderApp(DETAIL_PATH);

    await title();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Asignación' })).not.toBeInTheDocument();
    expect(api.callsTo(ASSIGNEES)).toHaveLength(0);
  });

  it('cada acción depende solo de su `allowedAction`', async () => {
    setupApi({ ...INCIDENT, allowedActions: ['assign'] });

    renderApp(DETAIL_PATH);

    await assignSection();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('un 404 muestra "Incidencia no encontrada." con un enlace al listado', async () => {
    const api = setupApi();
    api.on(DETAIL, () =>
      errorResponse(404, 'NOT_FOUND', 'No existe la incidencia o no tienes acceso.'),
    );

    renderApp(DETAIL_PATH);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Incidencia no encontrada.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al listado de incidencias' })).toHaveAttribute(
      'href',
      '/incidencias',
    );
  });

  it('otro error muestra el mensaje en español', async () => {
    const api = setupApi();
    api.on(DETAIL, () => errorResponse(400, 'VALIDATION', 'Petición no válida.'));

    renderApp(DETAIL_PATH);

    expect(await screen.findByRole('alert')).toHaveTextContent('Petición no válida.');
  });
});

describe('CA-03.15 · asignación desde el detalle', () => {
  it('al asignar llama a la API y el detalle muestra el asignado nuevo y un aviso', async () => {
    const api = setupApi();
    api.on(ASSIGN, () => jsonResponse(200, { ...INCIDENT, assignee: PEOPLE.PABLO }));
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    const section = await assignSection();
    const select = await within(section).findByRole('combobox', { name: 'Asignar a' });
    await waitFor(() => expect(select).toHaveValue(PEOPLE.MARTA.id));

    await user.selectOptions(select, PEOPLE.PABLO.id);
    await user.click(within(section).getByRole('button', { name: 'Asignar' }));

    expect(await screen.findByText('Incidencia asignada a Pablo Sanz.')).toBeInTheDocument();
    const [request] = api.callsTo(ASSIGN);
    expect(JSON.parse(String(request?.init.body))).toEqual({ assigneeId: PEOPLE.PABLO.id });
    expect(new Headers(request?.init.headers).get('X-Requested-With')).toBe('fetch');
    // El resumen y el selector muestran al nuevo asignado.
    expect(screen.getByText(PEOPLE.PABLO.name, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByText(PEOPLE.MARTA.name, { selector: 'dd' })).not.toBeInTheDocument();
    expect(within(await assignSection()).getByRole('combobox', { name: 'Asignar a' })).toHaveValue(
      PEOPLE.PABLO.id,
    );
  });

  it('un error de la API se muestra en español y la elección no se pierde', async () => {
    const api = setupApi();
    api.on(ASSIGN, () =>
      errorResponse(
        400,
        'VALIDATION',
        'El usuario no pertenece al departamento de la incidencia o está desactivado.',
      ),
    );
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    const section = await assignSection();
    const select = await within(section).findByRole('combobox', { name: 'Asignar a' });
    await waitFor(() => expect(select).toHaveValue(PEOPLE.MARTA.id));

    await user.selectOptions(select, PEOPLE.LUIS.id);
    await user.click(within(section).getByRole('button', { name: 'Asignar' }));

    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'El usuario no pertenece al departamento de la incidencia o está desactivado.',
    );
    expect(select).toHaveValue(PEOPLE.LUIS.id);
  });

  it('el aviso desaparece si el asignado cambia después (p. ej., otra persona la reasigna)', async () => {
    const api = setupApi();
    api.on(ASSIGN, () => jsonResponse(200, { ...INCIDENT, assignee: PEOPLE.PABLO }));
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    const section = await assignSection();
    const select = await within(section).findByRole('combobox', { name: 'Asignar a' });
    await user.selectOptions(select, PEOPLE.PABLO.id);
    await user.click(within(section).getByRole('button', { name: 'Asignar' }));
    await screen.findByText('Incidencia asignada a Pablo Sanz.');

    // Al volver a la ventana se vuelve a pedir el detalle y llega otro asignado.
    api.on(DETAIL, () => jsonResponse(200, { ...INCIDENT, assignee: PEOPLE.LUIS }));
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    // Luis también es el creador: se comprueba el valor del dato "Asignada a".
    const assigneeValue = () =>
      screen.getByText('Asignada a', { selector: 'dt' }).nextElementSibling;
    await waitFor(() => expect(assigneeValue()).toHaveTextContent(PEOPLE.LUIS.name));
    expect(screen.queryByText(/Incidencia asignada a/)).not.toBeInTheDocument();
    act(() => focusManager.setFocused(undefined));
  });
});
