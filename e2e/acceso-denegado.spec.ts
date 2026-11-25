import { createIncident, expect, openSessionAs, test, uniqueTitle } from './fixtures/session';

test('CA-07.7: el Usuario ve acceso denegado en /usuarios y no encontrada en una incidencia de otro departamento', async ({
  browser,
}) => {
  const title = uniqueTitle('Lote con humedad fuera de rango');
  const description = 'Descripción reservada del departamento de Calidad.';

  // El Admin crea una incidencia de tipo Calidad (departamento CAL): el Usuario demo es de LOG.
  const adminPage = await openSessionAs(browser, 'ADMIN');
  const { id } = await createIncident(adminPage, { title, description, type: 'Calidad' });
  await adminPage.context().close();

  const userPage = await openSessionAs(browser, 'USER');

  await userPage.goto('/admin/usuarios');
  await expect(
    userPage.getByRole('heading', { name: 'No tienes permiso para ver esta página.' }),
  ).toBeVisible();

  await userPage.goto(`/incidencias/${id}`);
  await expect(userPage.getByRole('heading', { name: 'Incidencia no encontrada.' })).toBeVisible();
  await expect(userPage.getByText(title)).toHaveCount(0);
  await expect(userPage.getByText(description)).toHaveCount(0);

  await userPage.context().close();
});
