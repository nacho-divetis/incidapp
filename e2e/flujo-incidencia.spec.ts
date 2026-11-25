import { createIncident, expect, openSessionAs, test, uniqueTitle } from './fixtures/session';

test('CA-07.6: el Usuario crea, empieza y resuelve una incidencia de Transporte y el Responsable la cierra', async ({
  browser,
}) => {
  const title = uniqueTitle('Palé dañado en el muelle');
  const comment = `Se repone la mercancía y se reubica el palé ${Date.now()}`;

  // Usuario: crear → Empezar → Marcar como resuelta (con comentario obligatorio).
  const userPage = await openSessionAs(browser, 'USER');
  const { id, code } = await createIncident(userPage, {
    title,
    description: 'El palé llegó con el film roto y varias cajas golpeadas.',
    type: 'Transporte',
  });
  expect(code).toMatch(/^INC-\d{4}-\d{4}$/);

  const dialog = userPage.getByRole('alertdialog');
  await userPage.getByRole('button', { name: 'Empezar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(dialog).toBeHidden();

  await userPage.getByRole('button', { name: 'Marcar como resuelta', exact: true }).click();
  await dialog.getByRole('button', { name: 'Marcar como resuelta', exact: true }).click();
  await expect(dialog.getByText('Esta transición requiere un comentario.')).toBeVisible();
  await dialog.getByLabel('Comentario').fill(comment);
  await dialog.getByRole('button', { name: 'Marcar como resuelta', exact: true }).click();
  await expect(dialog).toBeHidden();
  // El Usuario no puede cerrar la incidencia resuelta.
  await expect(userPage.getByRole('button', { name: 'Cerrar', exact: true })).toHaveCount(0);

  // Responsable (LOG): abre la incidencia y la cierra.
  const managerPage = await openSessionAs(browser, 'MANAGER');
  await managerPage.goto(`/incidencias/${id}`);
  await expect(managerPage.getByText(code, { exact: true }).first()).toBeVisible();
  await managerPage.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const managerDialog = managerPage.getByRole('alertdialog');
  await managerDialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(managerDialog).toBeHidden();

  // Estado final y línea de tiempo: alta + 3 cambios de estado, con el comentario.
  await managerPage.reload();
  const items = managerPage
    .getByRole('list', { name: 'Historial de la incidencia' })
    .getByRole('listitem');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('creó la incidencia');
  await expect(items.nth(1)).toContainText('cambió el estado de Abierta a En curso');
  await expect(items.nth(2)).toContainText('cambió el estado de En curso a Resuelta');
  await expect(items.nth(2)).toContainText(comment);
  await expect(items.nth(3)).toContainText('cambió el estado de Resuelta a Cerrada');
  await expect(managerPage.getByRole('group', { name: 'Cambiar el estado' })).toContainText(
    'Reabrir',
  );

  await userPage.context().close();
  await managerPage.context().close();
});
