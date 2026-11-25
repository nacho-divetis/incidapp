import type { DepartmentSummary, Role, UserSummary } from '@incidapp/shared';

/**
 * Usuario tal como lo gestiona el Admin: sin el *hash* de la contraseña y sin `allowedActions`
 * (las calcula la `AuthorizationPolicy` para cada actor).
 */
export interface ManagedUser {
  id: string;
  /** Email normalizado (sin espacios y en minúsculas). */
  email: string;
  name: string;
  role: Role;
  active: boolean;
  /** Sus departamentos, ordenados por código. */
  departments: DepartmentSummary[];
  createdAt: Date;
}

/** Datos de un usuario nuevo. El *hash* ya viene calculado: el repositorio nunca ve la contraseña. */
export interface NewUserData {
  email: string;
  name: string;
  role: Role;
  departmentIds: readonly string[];
  passwordHash: string;
  createdAt: Date;
}

/** Cambios de una edición. Solo se tocan los campos presentes; `departmentIds` sustituye a los actuales. */
export interface UserChanges {
  email?: string;
  name?: string;
  role?: Role;
  departmentIds?: readonly string[];
}

/**
 * Puerto de la gestión de usuarios (tablas `users` y `user_departments`). Un email repetido (también
 * de un usuario desactivado) hace que `create` y `update` lancen `ConflictError`.
 */
export interface UserAdminRepository {
  /** Todos los usuarios, activos y desactivados, ordenados por nombre. */
  list(): Promise<ManagedUser[]>;
  /** El usuario con ese id, o `null` si no existe (también si `id` no es un UUID). */
  findById(id: string): Promise<ManagedUser | null>;
  /** El usuario con ese email ya normalizado, esté activo o no; `null` si no existe. */
  findByEmail(email: string): Promise<ManagedUser | null>;
  create(data: NewUserData): Promise<ManagedUser>;
  update(id: string, changes: UserChanges): Promise<ManagedUser>;
  setActive(id: string, active: boolean): Promise<ManagedUser>;
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  /** Usuarios **activos** del departamento, ordenados por nombre (candidatos a asignar, CA-03.10). */
  listActiveByDepartment(departmentId: string): Promise<UserSummary[]>;
}
