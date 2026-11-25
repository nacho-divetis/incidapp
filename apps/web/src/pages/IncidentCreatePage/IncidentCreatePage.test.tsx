// CA-03.13 (alta desde la web) con `fetch` simulado (rutas y providers reales).
import type { CurrentUser } from '@incidapp/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_USER, jsonResponse, mockApi, never } from '../../test/api-mock';
import { INCIDENT, INCIDENT_TYPES, INCIDENT_TYPE_LIST } from '../../test/incident-fixtures';
import { renderApp } from '../../test/render-app';

const ME = 'GET /api/auth/me';
const TYPES = 'GET /api/incident-types';
const CREATE = 'POST /api/incidents';
const CREATE_PATH = '/incidencias/nueva';

/** Dirección: sin `createIncident`. */
const DIRECTOR: CurrentUser = {
  ...DEMO_USER,
  role: 'DIRECTOR',
  allowedActions: ['viewDashboard', 'viewAudit'],
};

function setupApi(user: CurrentUser = DEMO_USER) {
  return mockApi({
    [ME]: () => jsonResponse(200, user),
    [TYPES]: () => jsonResponse(200, INCIDENT_TYPE_LIST),
  });
}

function fields() {
  return {
    title: screen.getByRole('textbox', { name: /título/i }),
    description: screen.getByRole('textbox', { name: /descripción/i }),
    type: screen.getByRole('combobox', { name: /tipo/i }),
    priority: screen.getByRole('combobox', { name: /prioridad/i }),
    dueDate: screen.getByLabelText(/fecha objetivo/i),
  };
}

const createButton = () => screen.findByRole('button', { name: 'Crear incidencia' });

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  const form = fields();
  await user.type(form.title, INCIDENT.title);
  await user.type(form.description, 'El palé llegó con el film roto.');
  await user.selectOptions(form.type, INCIDENT_TYPES.TRANSPORT.id);
  await user.selectOptions(form.priority, 'HIGH');
}

describe('CA-03.13 · alta desde la web', () => {
  it('sin `createIncident` muestra "sin permiso" y no pide los tipos', async () => {
    const api = setupApi(DIRECTOR);

    renderApp(CREATE_PATH);

    expect(
      await screen.findByRole('heading', { name: 'No tienes permiso para ver esta página.' }),
    ).toBeInTheDocument();
    expect(api.callsTo(TYPES)).toHaveLength(0);
  });

  it('mientras cargan los tipos muestra un indicador', async () => {
    const api = setupApi();
    api.on(TYPES, never);

    renderApp(CREATE_PATH);

    expect(await screen.findByText('Cargando el formulario…')).toBeInTheDocument();
  });

  it('al elegir el tipo muestra el departamento que la recibirá', async () => {
    setupApi();
    const user = userEvent.setup();
    renderApp(CREATE_PATH);
    await createButton();

    await user.selectOptions(fields().type, INCIDENT_TYPES.CUSTOMER.id);

    expect(fields().type).toHaveAccessibleDescription(
      'Lo recibirá: Atención al Cliente / Postventa.',
    );
  });

  it('valida en el cliente: errores junto a cada campo y sin llamar a la API', async () => {
    const api = setupApi();
    const user = userEvent.setup();
    renderApp(CREATE_PATH);

    await user.click(await createButton());

    const form = fields();
    expect(form.title).toHaveAttribute('aria-invalid', 'true');
    expect(form.title).toHaveAccessibleDescription(/El título es obligatorio\./);
    expect(form.type).toHaveAccessibleDescription(/Selecciona el tipo de incidencia\./);
    expect(form.title).toHaveFocus();
    expect(api.callsTo(CREATE)).toHaveLength(0);
  });

  it('al crear envía los datos y navega al detalle con un aviso', async () => {
    const api = setupApi();
    api.on(CREATE, () => jsonResponse(201, INCIDENT));
    api.on(`GET /api/incidents/${INCIDENT.id}`, () => jsonResponse(200, INCIDENT));
    api.on(`GET /api/incidents/${INCIDENT.id}/assignees`, () => jsonResponse(200, []));
    const user = userEvent.setup();
    const { currentPath } = renderApp(CREATE_PATH);
    await createButton();

    await fillForm(user);
    await user.type(fields().dueDate, '2026-11-30');
    await user.click(await createButton());

    expect(await screen.findByText('Incidencia creada.')).toBeInTheDocument();
    expect(currentPath()).toBe(`/incidencias/${INCIDENT.id}`);
    expect(screen.getByRole('heading', { level: 1, name: INCIDENT.title })).toBeInTheDocument();
    const [request] = api.callsTo(CREATE);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      title: INCIDENT.title,
      description: 'El palé llegó con el film roto.',
      typeId: INCIDENT_TYPES.TRANSPORT.id,
      priority: 'HIGH',
      dueDate: '2026-11-30',
    });
  });

  it('un 400 de la API va junto a su campo sin perder lo escrito', async () => {
    const api = setupApi();
    api.on(CREATE, () =>
      jsonResponse(400, {
        error: {
          code: 'VALIDATION',
          message: 'Hay campos con errores.',
          details: [{ path: 'typeId', message: 'El tipo de incidencia no existe.' }],
        },
      }),
    );
    const user = userEvent.setup();
    const { currentPath } = renderApp(CREATE_PATH);
    await createButton();

    await fillForm(user);
    await user.click(await createButton());

    const { type, title } = fields();
    await waitFor(() => expect(type).toHaveAttribute('aria-invalid', 'true'));
    expect(type).toHaveAccessibleDescription(/El tipo de incidencia no existe\./);
    expect(title).toHaveValue(INCIDENT.title);
    expect(currentPath()).toBe(CREATE_PATH);
  });

  it('otros errores de la API se muestran en un aviso en español', async () => {
    const api = setupApi();
    api.on(CREATE, () =>
      jsonResponse(403, {
        error: { code: 'FORBIDDEN', message: 'No tienes permiso para hacer esta acción.' },
      }),
    );
    const user = userEvent.setup();
    renderApp(CREATE_PATH);
    await createButton();

    await fillForm(user);
    await user.click(await createButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para hacer esta acción.',
    );
    expect(fields().title).toHaveValue(INCIDENT.title);
  });

  it('"Cancelar" vuelve al listado', async () => {
    setupApi();
    renderApp(CREATE_PATH);
    await createButton();

    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/incidencias');
  });
});
