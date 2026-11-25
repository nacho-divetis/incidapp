import { DEMO_PASSWORD, DEMO_USERS, type Role } from '@incidapp/shared';
import { expect, test as base, type Browser, type Page } from '@playwright/test';

export function demoUser(role: Role) {
  const user = DEMO_USERS.find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No hay usuario demo con el rol ${role}`);
  return user;
}

/** Inicia sesión desde la pantalla de login con el usuario demo de ese rol. */
export async function login(page: Page, role: Role): Promise<void> {
  const user = demoUser(role);
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // El botón solo existe con la sesión iniciada (el panel de demo de /login también muestra nombres).
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

/** Abre un contexto nuevo (sin cookies) y entra con ese rol. */
export async function openSessionAs(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, role);
  return page;
}

/** Crea una incidencia desde la interfaz y devuelve su id y su código. */
export async function createIncident(
  page: Page,
  input: { title: string; description: string; type: string },
): Promise<{ id: string; code: string }> {
  await page.goto('/incidencias/nueva');
  await page.getByLabel('Título').fill(input.title);
  await page.getByLabel('Descripción').fill(input.description);
  await page.getByLabel('Tipo').selectOption({ label: input.type });
  await page.getByRole('button', { name: 'Crear incidencia' }).click();
  await expect(page.getByText('Incidencia creada.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: input.title })).toBeVisible();
  const id = decodeURIComponent(new URL(page.url()).pathname.split('/').pop() ?? '');
  const code =
    (await page
      .getByText(/^INC-\d{4}-\d{4}$/)
      .first()
      .textContent()) ?? '';
  return { id, code };
}

/** Título único por ejecución: los tests no dependen del orden ni de datos previos. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export { base as test, expect };
