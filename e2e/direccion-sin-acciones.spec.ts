import { createIncident, expect, openSessionAs, test, uniqueTitle } from './fixtures/session';

const ACTION_BUTTONS = [
  'Empezar',
  'Rechazar',
  'Cerrar',
  'Reabrir',
  'Marcar como resuelta',
  'Devolver a en curso',
  'Pendiente de tercero',
  'Reanudar',
];

test('CA-07.8: Dirección no ve acciones de escritura en el listado ni en el detalle', async ({
  browser,
}) => {
  const title = uniqueTitle('Cliente reclama un envío incompleto');

  const adminPage = await openSessionAs(browser, 'ADMIN');
  const { id } = await createIncident(adminPage, {
    title,
    description: 'Faltan dos cajas en el pedido entregado.',
    type: 'Cliente / Reclamación',
  });
  await adminPage.context().close();

  const directorPage = await openSessionAs(browser, 'DIRECTOR');

  await directorPage.goto('/incidencias');
  await expect(directorPage.getByRole('heading', { level: 1, name: 'Incidencias' })).toBeVisible();
  await expect(directorPage.getByRole('table')).toBeVisible();
  await expect(directorPage.getByRole('link', { name: 'Nueva incidencia' })).toHaveCount(0);

  await directorPage.goto(`/incidencias/${id}`);
  await expect(directorPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(
    directorPage.getByRole('list', { name: 'Historial de la incidencia' }),
  ).toBeVisible();
  await expect(directorPage.getByRole('link', { name: 'Editar' })).toHaveCount(0);
  await expect(directorPage.getByRole('group', { name: 'Cambiar el estado' })).toHaveCount(0);
  await expect(directorPage.getByRole('button', { name: /asignar/i })).toHaveCount(0);
  for (const name of ACTION_BUTTONS) {
    await expect(directorPage.getByRole('button', { name, exact: true })).toHaveCount(0);
  }

  await directorPage.context().close();
});
