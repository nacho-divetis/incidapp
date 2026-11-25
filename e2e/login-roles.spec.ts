import { DEMO_USERS } from '@incidapp/shared';
import { expect, login, test } from './fixtures/session';

test.describe('CA-07.5: login por rol', () => {
  for (const user of DEMO_USERS) {
    test(`CA-07.5: ${user.role} inicia sesión, ve su nombre y solo el Admin ve "Usuarios"`, async ({
      page,
    }) => {
      await login(page, user.role);
      // En la cabecera: el nombre también puede salir en el listado (columna Asignado de los datos demo).
      await expect(page.getByRole('banner').getByText(user.name, { exact: true })).toBeVisible();

      const usersLink = page.getByRole('link', { name: 'Usuarios' });
      if (user.role === 'ADMIN') await expect(usersLink).toBeVisible();
      else await expect(usersLink).toHaveCount(0);
    });

    test(`CA-07.5: ${user.role} cierra sesión, vuelve al login y una ruta protegida lo redirige allí`, async ({
      page,
    }) => {
      await login(page, user.role);
      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

      await page.goto('/incidencias');
      await expect(page).toHaveURL(/\/login/);
    });

    test(`CA-07.5: ${user.role} llega al listado de incidencias al iniciar sesión`, async ({
      page,
    }) => {
      await login(page, user.role);
      await expect(page).toHaveURL(/\/incidencias$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Incidencias' })).toBeVisible();
    });
  }
});
