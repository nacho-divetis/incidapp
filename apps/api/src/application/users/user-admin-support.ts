// Piezas comunes de los casos de uso de la gestión de usuarios. La decisión de qué se puede hacer es
// siempre de la `AuthorizationPolicy`; aquí solo se traduce a errores y a la respuesta.
import {
  isDemoUserEmail,
  type CurrentUser,
  type DepartmentSummary,
  type UserAction,
  type UserAdmin,
} from '@incidapp/shared';
import { actorOf, globalActionsFor, userActionsFor } from '../authorization/authorization-policy';
import { authorize } from '../authorization/authorize';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import type { DepartmentRepository } from '../ports/department-repository';
import type { ManagedUser, UserAdminRepository } from '../ports/user-admin-repository';
import {
  DEMO_USER_PROTECTED_MESSAGE,
  SELF_LOCKOUT_MESSAGE,
  UNKNOWN_DEPARTMENT_MESSAGE,
} from './user-messages';

/**
 * Primera comprobación de toda la gestión de usuarios: solo quien tiene `manageUsers` (el Admin).
 * Va antes que buscar el usuario y que cualquier regla, para que un no-Admin reciba siempre 403 y
 * nunca sepa si un id existe (CA-02.5).
 */
export function assertCanManageUsers(actor: CurrentUser): void {
  authorize({ visible: true, allowed: globalActionsFor(actor).includes('manageUsers') });
}

/** Usuario como lo devuelve la API, con las acciones que el actor puede hacer sobre él. */
export function toUserAdmin(actor: CurrentUser, user: ManagedUser): UserAdmin {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    departments: user.departments,
    createdAt: user.createdAt.toISOString(),
    allowedActions: userActionsFor(actorOf(actor), user),
  };
}

/** Busca el usuario o lanza `NotFoundError` (404), también si el id no es un UUID (CA-02.6). */
export async function findUserOrThrow(
  users: UserAdminRepository,
  id: string,
): Promise<ManagedUser> {
  const user = await users.findById(id);
  if (!user) throw new NotFoundError();
  return user;
}

/**
 * Exige que la política permita `action` sobre el usuario. Como el actor ya es Admin, si no la
 * permite es por una regla de negocio y la respuesta es 409 con el mensaje de esa regla
 * (CA-02.10, CA-02.11): usuario demo o el propio Admin.
 */
export function requireUserAction(actor: CurrentUser, user: ManagedUser, action: UserAction): void {
  if (userActionsFor(actorOf(actor), user).includes(action)) return;
  throw new ConflictError(
    isDemoUserEmail(user.email) ? DEMO_USER_PROTECTED_MESSAGE : SELF_LOCKOUT_MESSAGE,
  );
}

/**
 * Devuelve los departamentos de `ids` o lanza `ValidationError` (400) si alguno no existe
 * (CA-02.7). El detalle va en el campo `departmentIds`, como un error del esquema.
 */
export async function findDepartmentsOrThrow(
  departments: DepartmentRepository,
  ids: readonly string[],
): Promise<DepartmentSummary[]> {
  const found = await departments.findByIds(ids);
  if (found.length !== new Set(ids).size) {
    throw new ValidationError(undefined, [
      { path: 'departmentIds', message: UNKNOWN_DEPARTMENT_MESSAGE },
    ]);
  }
  return found;
}

/** Códigos de los departamentos, ordenados: así se guardan en la auditoría. */
export const departmentCodes = (departments: readonly DepartmentSummary[]): string[] =>
  departments.map((department) => department.code).sort();
