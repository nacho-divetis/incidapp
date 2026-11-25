// La edición de CA-03.15 con `fetch` simulado (rutas y providers reales).
import type { Incident } from '@incidapp/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_USER, errorResponse, jsonResponse, mockApi, never } from '../../test/api-mock';
import { INCIDENT, PEOPLE } from '../../test/incident-fixtures';
import { renderApp } from '../../test/render-app';

const ME = 'GET /api/auth/me';
const DETAIL = `GET /api/incidents/${INCIDENT.id}`;
const UPDATE = `PATCH /api/incidents/${INCIDENT.id}`;
const DETAIL_PATH = `/incidencias/${INCIDENT.id}`;
const EDIT_PATH = `${DETAIL_PATH}/editar`;

function setupApi(incident: Incident = INCIDENT) {
  return mockApi({
    [ME]: () => jsonResponse(200, DEMO_USER),
    [DETAIL]: () => jsonResponse(200, incident),
    [`GET /api/incidents/${INCIDENT.id}/assignees`]: () => jsonResponse(200, [PEOPLE.MARTA]),
  });
}

function fields() {
  return {
    title: screen.getByRole('textbox', { name: /título/i }),
    description: screen.getByRole('textbox', { name: /descripción/i }),
    priority: screen.getByRole('combobox', { name: /prioridad/i }),
    dueDate: screen.getByLabelText(/fecha objetivo/i),
  };
}

const saveButton = () => screen.findByRole('button', { name: 'Guardar cambios' });

describe('CA-03.15 · edición desde la web', () => {
  it('mientras carga muestra un indicador', async () => {
    const api = setupApi();
    api.on(DETAIL, never);

    renderApp(EDIT_PATH);

    expect(await screen.findByText('Cargando la incidencia…')).toBeInTheDocument();
  });

  it('el formulario viene precargado y no tiene el campo de tipo', async () => {
    setupApi();

    renderApp(EDIT_PATH);

    await saveButton();
    const form = fields();
    expect(form.title).toHaveValue(INCIDENT.title);
    expect(form.description).toHaveValue(INCIDENT.description);
    expect(form.priority).toHaveValue('HIGH');
    expect(form.dueDate).toHaveValue('2026-11-30');
    expect(screen.queryByRole('combobox', { name: /tipo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', DETAIL_PATH);
  });

  it('al guardar llama a la API y el detalle muestra los datos nuevos y un aviso', async () => {
    const saved: Incident = { ...INCIDENT, title: 'Palé dañado en el muelle 2', dueDate: null };
    const api = setupApi();
    api.on(UPDATE, () => jsonResponse(200, saved));
    const user = userEvent.setup();
    const { currentPath } = renderApp(EDIT_PATH);
    await saveButton();

    await user.clear(fields().title);
    await user.type(fields().title, saved.title);
    await user.clear(fields().dueDate);
    await user.click(await saveButton());

    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(currentPath()).toBe(DETAIL_PATH);
    expect(screen.getByRole('heading', { level: 1, name: saved.title })).toBeInTheDocument();
    expect(screen.getByText('Sin fecha objetivo')).toBeInTheDocument();
    const [request] = api.callsTo(UPDATE);
    expect(JSON.parse(String(request?.init.body))).toEqual({
      title: saved.title,
      description: INCIDENT.description,
      priority: 'HIGH',
      dueDate: null,
    });
  });

  it('un 400 de la API va junto a su campo sin perder lo escrito', async () => {
    const api = setupApi();
    api.on(UPDATE, () =>
      jsonResponse(400, {
        error: {
          code: 'VALIDATION',
          message: 'Hay campos con errores.',
          details: [{ path: 'title', message: 'El título no es válido.' }],
        },
      }),
    );
    const user = userEvent.setup();
    const { currentPath } = renderApp(EDIT_PATH);
    await saveButton();

    await user.type(fields().description, ' Añadido.');
    await user.click(await saveButton());

    const { title, description } = fields();
    await waitFor(() => expect(title).toHaveAttribute('aria-invalid', 'true'));
    expect(title).toHaveAccessibleDescription(/El título no es válido\./);
    expect(description).toHaveValue(`${INCIDENT.description} Añadido.`);
    expect(currentPath()).toBe(EDIT_PATH);
  });

  it('un 403 (p. ej., la incidencia ya no está abierta) se muestra en español', async () => {
    const api = setupApi();
    api.on(UPDATE, () =>
      errorResponse(403, 'FORBIDDEN', 'No tienes permiso para hacer esta acción.'),
    );
    const user = userEvent.setup();
    renderApp(EDIT_PATH);
    await saveButton();

    await user.click(await saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para hacer esta acción.',
    );
    expect(fields().title).toHaveValue(INCIDENT.title);
  });

  it('sin `update` en `allowedActions` muestra "sin permiso"', async () => {
    setupApi({ ...INCIDENT, allowedActions: ['assign'] });

    renderApp(EDIT_PATH);

    expect(
      await screen.findByRole('heading', { name: 'No tienes permiso para ver esta página.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });

  it('un 404 muestra "Incidencia no encontrada."', async () => {
    const api = setupApi();
    api.on(DETAIL, () =>
      errorResponse(404, 'NOT_FOUND', 'No existe la incidencia o no tienes acceso.'),
    );

    renderApp(EDIT_PATH);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Incidencia no encontrada.' }),
    ).toBeInTheDocument();
  });
});
