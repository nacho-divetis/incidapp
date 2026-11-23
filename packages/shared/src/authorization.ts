import { z } from 'zod';

/**
 * Acciones que no dependen de un recurso concreto. La API las calcula con la `AuthorizationPolicy`
 * y las devuelve en `CurrentUser.allowedActions`; la web solo las lee (no recalcula permisos).
 */
export const GlobalAction = z.enum(['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard']);
export type GlobalAction = z.infer<typeof GlobalAction>;

/**
 * Acciones del Admin sobre un usuario concreto (`UserAdmin.allowedActions`). Reflejan las reglas de
 * negocio: nadie se desactiva ni se quita el rol a sí mismo, y de un usuario demo solo se cambia el
 * nombre.
 */
export const UserAction = z.enum([
  'rename',
  'changeEmail',
  'changeRole',
  'changeDepartments',
  'deactivate',
  'activate',
  'resetPassword',
]);
export type UserAction = z.infer<typeof UserAction>;
