// Datos ficticios de la gestión de usuarios para los tests de queries y páginas.
import type { DepartmentSummary, UserAdmin } from '@incidapp/shared';
import { DEMO_ADMIN } from './api-mock';

export const DEPARTMENTS: DepartmentSummary[] = [
  { id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', code: 'ADM', name: 'Administración' },
  { id: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e', code: 'LOG', name: 'Logística' },
  { id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f', code: 'MNT', name: 'Mantenimiento' },
];

const [ADM, LOG, MNT] = DEPARTMENTS as [DepartmentSummary, DepartmentSummary, DepartmentSummary];

/** Todas las acciones sobre un usuario activo que no es demo ni el propio Admin. */
export const ALL_ACTIVE_ACTIONS: UserAdmin['allowedActions'] = [
  'rename',
  'changeEmail',
  'changeRole',
  'changeDepartments',
  'deactivate',
  'resetPassword',
];

/** Usuario normal (creado desde la gestión de usuarios), activo. */
export const LUCIA: UserAdmin = {
  id: '3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a',
  email: 'lucia.gil@incidapp.test',
  name: 'Lucía Gil',
  role: 'MANAGER',
  active: true,
  departments: [LOG, MNT],
  createdAt: '2026-11-20T10:00:00.000Z',
  allowedActions: ALL_ACTIVE_ACTIONS,
};

/** El propio Admin con sesión: sin `changeRole` ni `deactivate`. */
export const SELF_ADMIN: UserAdmin = {
  id: DEMO_ADMIN.id,
  email: DEMO_ADMIN.email,
  name: DEMO_ADMIN.name,
  role: 'ADMIN',
  active: true,
  departments: [ADM],
  createdAt: '2026-11-01T08:00:00.000Z',
  allowedActions: ['rename'],
};

/** Usuario demo (no es el actual): solo se puede cambiar el nombre. */
export const DEMO_MANAGER: UserAdmin = {
  id: '4e5f6a7b-8c9d-4e0f-9a1b-3c4d5e6f7a8b',
  email: 'responsable@incidapp.test',
  name: 'Carmen Vidal',
  role: 'MANAGER',
  active: true,
  departments: [LOG],
  createdAt: '2026-11-01T08:00:00.000Z',
  allowedActions: ['rename'],
};

/** Copia de `user` desactivado, con las acciones que daría la API. */
export function deactivated(user: UserAdmin): UserAdmin {
  return {
    ...user,
    active: false,
    allowedActions: user.allowedActions.map((action) =>
      action === 'deactivate' ? 'activate' : action,
    ),
  };
}
