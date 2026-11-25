// CA-03.14 (detalle), la asignación de CA-03.15, las acciones de estado de CA-04.8 y la línea de
// tiempo de CA-04.9, con `fetch` simulado (rutas y providers reales).
import type { Incident, IncidentEvent } from '@incidapp/shared';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_USER, errorResponse, jsonResponse, mockApi, never } from '../../test/api-mock';
import {
  INCIDENT,
  INCIDENT_EVENTS,
  PEOPLE,
  UNASSIGNED_INCIDENT,
} from '../../test/incident-fixtures';
import { renderApp } from '../../test/render-app';

const ME = 'GET /api/auth/me';
const DETAIL = `GET /api/incidents/${INCIDENT.id}`;
const ASSIGNEES = `GET /api/incidents/${INCIDENT.id}/assignees`;
const ASSIGN = `POST /api/incidents/${INCIDENT.id}/assign`;
const EVENTS = `GET /api/incidents/${INCIDENT.id}/events`;
const TRANSITIONS = `POST /api/incidents/${INCIDENT.id}/transitions`;
const DETAIL_PATH = `/incidencias/${INCIDENT.id}`;

function setupApi(incident: Incident = INCIDENT) {
  return mockApi({
    [ME]: () => jsonResponse(200, DEMO_USER),
    [DETAIL]: () => jsonResponse(200, incident),
    [ASSIGNEES]: () => jsonResponse(200, [PEOPLE.LUIS, PEOPLE.MARTA, PEOPLE.PABLO]),
    [EVENTS]: () => jsonResponse(200, INCIDENT_EVENTS),
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
    expect(screen.getByText(PEOPLE.LUIS.name, { selector: 'dd' })).toBeInTheDocument();
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

  it('al asignar se vuelve a pedir el historial', async () => {
    const api = setupApi();
    api.on(ASSIGN, () => jsonResponse(200, { ...INCIDENT, assignee: PEOPLE.PABLO }));
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    const section = await assignSection();
    const select = await within(section).findByRole('combobox', { name: 'Asignar a' });
    await screen.findByRole('list', { name: 'Historial de la incidencia' });
    expect(api.callsTo(EVENTS)).toHaveLength(1);

    await user.selectOptions(select, PEOPLE.PABLO.id);
    await user.click(within(section).getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(api.callsTo(EVENTS)).toHaveLength(2));
  });
});

/** La incidencia en curso, con lo que permite la API a quien la lleva. */
const IN_PROGRESS_INCIDENT: Incident = {
  ...INCIDENT,
  status: 'IN_PROGRESS',
  allowedTransitions: [
    { to: 'PENDING_THIRD_PARTY', requiresComment: false },
    { to: 'RESOLVED', requiresComment: true },
  ],
};

const RESOLVED_EVENT: IncidentEvent = {
  id: 'be5f6a7b-0003-4e0f-9a1b-3c4d5e6f7a03',
  type: 'STATUS_CHANGED',
  actor: PEOPLE.MARTA,
  createdAt: '2026-11-25T10:30:00.000Z',
  data: { from: 'IN_PROGRESS', to: 'RESOLVED', comment: 'Palé repuesto por el proveedor.' },
};

const statusActions = () => screen.findByRole('group', { name: 'Cambiar el estado' });
const statusDialog = () => screen.findByRole('alertdialog');

describe('CA-04.8 · acciones de estado en el detalle', () => {
  it('muestra un botón por cada transición de `allowedTransitions`, con su texto', async () => {
    setupApi(IN_PROGRESS_INCIDENT);

    renderApp(DETAIL_PATH);

    const group = await statusActions();
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Pendiente de tercero', 'Marcar como resuelta']);
  });

  it('con `allowedTransitions` vacía no muestra ningún botón de estado (p. ej., Dirección)', async () => {
    setupApi({ ...UNASSIGNED_INCIDENT, allowedTransitions: [] });

    renderApp(DETAIL_PATH);

    await title();
    expect(screen.queryByRole('group', { name: 'Cambiar el estado' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /^(Empezar|Rechazar|Marcar como resuelta|Cerrar|Reabrir)$/,
      }),
    ).not.toBeInTheDocument();
  });

  it('los botones salen solo de `allowedTransitions`, aunque no haya otras acciones', async () => {
    setupApi({
      ...UNASSIGNED_INCIDENT,
      allowedTransitions: [{ to: 'IN_PROGRESS', requiresComment: false }],
    });

    renderApp(DETAIL_PATH);

    const group = await statusActions();
    expect(within(group).getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('al confirmar llama a la API, cierra el diálogo y actualiza el estado, los botones y el historial', async () => {
    const api = setupApi({
      ...INCIDENT,
      allowedTransitions: [{ to: 'IN_PROGRESS', requiresComment: false }],
    });
    api.on(TRANSITIONS, () => jsonResponse(200, IN_PROGRESS_INCIDENT));
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    const group = await statusActions();
    await screen.findByRole('list', { name: 'Historial de la incidencia' });

    await user.click(within(group).getByRole('button', { name: 'Empezar' }));
    const dialog = await statusDialog();
    expect(dialog).toHaveAccessibleName('Cambiar el estado a En curso');
    api.on(EVENTS, () =>
      jsonResponse(200, [
        ...INCIDENT_EVENTS,
        {
          id: 'be5f6a7b-0004-4e0f-9a1b-3c4d5e6f7a04',
          type: 'STATUS_CHANGED',
          actor: PEOPLE.MARTA,
          createdAt: '2026-11-25T08:00:00.000Z',
          data: { from: 'OPEN', to: 'IN_PROGRESS', comment: null },
        } satisfies IncidentEvent,
      ]),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Empezar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    const [request] = api.callsTo(TRANSITIONS);
    expect(JSON.parse(String(request?.init.body))).toEqual({ to: 'IN_PROGRESS' });
    expect(new Headers(request?.init.headers).get('X-Requested-With')).toBe('fetch');
    // Estado y botones nuevos, sacados de la respuesta.
    expect(screen.getByText('En curso', { selector: 'span' })).toBeInTheDocument();
    expect(
      within(await statusActions()).getByRole('button', { name: 'Marcar como resuelta' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Empezar' })).not.toBeInTheDocument();
    // El historial se vuelve a pedir y muestra el cambio.
    const timeline = screen.getByRole('list', { name: 'Historial de la incidencia' });
    expect(
      await within(timeline).findByText('cambió el estado de Abierta a En curso', { exact: false }),
    ).toBeInTheDocument();
    expect(api.callsTo(EVENTS)).toHaveLength(2);
  });

  it('el comentario obligatorio se valida en el cliente sin llamar a la API', async () => {
    const api = setupApi(IN_PROGRESS_INCIDENT);
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);

    await user.click(
      within(await statusActions()).getByRole('button', { name: 'Marcar como resuelta' }),
    );
    const dialog = await statusDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Marcar como resuelta' }));

    expect(within(dialog).getByRole('textbox', { name: /Comentario/ })).toHaveAccessibleDescription(
      expect.stringContaining('Esta transición requiere un comentario.'),
    );
    expect(api.callsTo(TRANSITIONS)).toHaveLength(0);
  });

  it('envía el comentario y el historial lo muestra', async () => {
    const api = setupApi(IN_PROGRESS_INCIDENT);
    api.on(TRANSITIONS, () =>
      jsonResponse(200, { ...INCIDENT, status: 'RESOLVED', allowedTransitions: [] }),
    );
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    await screen.findByRole('list', { name: 'Historial de la incidencia' });

    await user.click(
      within(await statusActions()).getByRole('button', { name: 'Marcar como resuelta' }),
    );
    const dialog = await statusDialog();
    await user.type(
      within(dialog).getByRole('textbox', { name: /Comentario/ }),
      '  Palé repuesto por el proveedor.  ',
    );
    api.on(EVENTS, () => jsonResponse(200, [...INCIDENT_EVENTS, RESOLVED_EVENT]));
    await user.click(within(dialog).getByRole('button', { name: 'Marcar como resuelta' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    const [request] = api.callsTo(TRANSITIONS);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      to: 'RESOLVED',
      comment: 'Palé repuesto por el proveedor.',
    });
    expect(await screen.findByText('Palé repuesto por el proveedor.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Cambiar el estado' })).not.toBeInTheDocument();
  });

  it('un error de la API se muestra en español dentro del diálogo sin perder el comentario', async () => {
    const api = setupApi(IN_PROGRESS_INCIDENT);
    api.on(TRANSITIONS, () =>
      errorResponse(409, 'CONFLICT', 'No se puede pasar de Resuelta a Resuelta.'),
    );
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);

    await user.click(
      within(await statusActions()).getByRole('button', { name: 'Marcar como resuelta' }),
    );
    const dialog = await statusDialog();
    const comment = within(dialog).getByRole('textbox', { name: /Comentario/ });
    await user.type(comment, 'Palé repuesto.');
    await user.click(within(dialog).getByRole('button', { name: 'Marcar como resuelta' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'No se puede pasar de Resuelta a Resuelta.',
    );
    expect(screen.getByRole('alertdialog')).toBe(dialog);
    expect(comment).toHaveValue('Palé repuesto.');
    // El estado no ha cambiado.
    expect(screen.getByText('En curso', { selector: 'span' })).toBeInTheDocument();
  });

  it('`Escape` cierra el diálogo sin llamar a la API y, al reabrirlo, empieza sin el error', async () => {
    const api = setupApi(IN_PROGRESS_INCIDENT);
    api.on(TRANSITIONS, () => errorResponse(403, 'FORBIDDEN', 'No tienes permiso.'));
    const user = userEvent.setup();
    renderApp(DETAIL_PATH);
    const group = await statusActions();

    await user.click(within(group).getByRole('button', { name: 'Pendiente de tercero' }));
    let dialog = await statusDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Pendiente de tercero' }));
    await within(dialog).findByRole('alert');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(within(group).getByRole('button', { name: 'Pendiente de tercero' }));
    dialog = await statusDialog();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(api.callsTo(TRANSITIONS)).toHaveLength(1);
  });
});

describe('CA-04.9 · línea de tiempo en el detalle', () => {
  it('muestra el historial en una lista ordenada con autor, frase y fecha', async () => {
    setupApi();

    renderApp(DETAIL_PATH);

    expect(await screen.findByRole('heading', { level: 2, name: 'Historial' })).toBeInTheDocument();
    const timeline = await screen.findByRole('list', { name: 'Historial de la incidencia' });
    expect(timeline.tagName).toBe('OL');
    const items = within(timeline).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Luis Navarro creó la incidencia');
    expect(items[0]).toHaveTextContent('24/11/2026 08:15');
    expect(items[1]).toHaveTextContent('Luis Navarro asignó a Marta Gil');
  });

  it('mientras carga muestra un indicador', async () => {
    const api = setupApi();
    api.on(EVENTS, never);

    renderApp(DETAIL_PATH);

    await title();
    expect(screen.getByText('Cargando el historial…')).toBeInTheDocument();
  });

  it('si falla muestra un `Alert` con el mensaje y el resto del detalle', async () => {
    const api = setupApi();
    api.on(EVENTS, () =>
      errorResponse(403, 'FORBIDDEN', 'No tienes permiso para hacer esta acción.'),
    );

    renderApp(DETAIL_PATH);

    const section = await screen.findByRole('region', { name: 'Historial' });
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'No tienes permiso para hacer esta acción.',
    );
    expect(screen.getByRole('heading', { level: 1, name: INCIDENT.title })).toBeInTheDocument();
  });
});
