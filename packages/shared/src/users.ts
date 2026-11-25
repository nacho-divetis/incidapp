import { z } from 'zod';
import { DepartmentSummary, Email, PASSWORD_MAX_LENGTH, Role } from './auth';
import { UserAction } from './authorization';

/** Longitud máxima del nombre de un usuario, ya sin los espacios de los extremos. */
export const USER_NAME_MAX_LENGTH = 100;

/** Longitud mínima de una contraseña nueva (alta y restablecimiento). */
export const PASSWORD_MIN_LENGTH = 8;

/** Nombre de un usuario: sin espacios en los extremos, de 1 a 100 caracteres. */
export const UserName = z
  .string({
    error: (issue) =>
      issue.input === undefined ? 'El nombre es obligatorio.' : 'El nombre no es válido.',
  })
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(USER_NAME_MAX_LENGTH, `El nombre no puede tener más de ${USER_NAME_MAX_LENGTH} caracteres.`);

/**
 * Contraseña nueva, de 8 a 200 caracteres. No se recorta: los espacios forman parte de ella, igual
 * que en el login.
 */
export const NewPassword = z
  .string({
    error: (issue) =>
      issue.input === undefined ? 'La contraseña es obligatoria.' : 'La contraseña no es válida.',
  })
  .min(PASSWORD_MIN_LENGTH, {
    error: (issue) =>
      issue.input === ''
        ? 'La contraseña es obligatoria.'
        : `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .max(
    PASSWORD_MAX_LENGTH,
    `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres.`,
  );

/** Rol elegido por el Admin en la gestión de usuarios, con mensajes en español. */
const UserRole = z.enum(Role.options, {
  error: (issue) => (issue.input === undefined ? 'El rol es obligatorio.' : 'El rol no es válido.'),
});

/**
 * Departamentos de un usuario: al menos uno y sin repetidos. Que existan lo comprueba la API.
 */
const DepartmentIds = z
  .array(z.uuid('El departamento no es válido.'), {
    error: (issue) =>
      issue.input === undefined
        ? 'Selecciona al menos un departamento.'
        : 'Los departamentos no son válidos.',
  })
  .min(1, 'Selecciona al menos un departamento.')
  .refine((ids) => new Set(ids).size === ids.length, 'Hay departamentos repetidos.');

/**
 * Cuerpo de `POST /api/users` (CA-02.7). Los campos que decide el servidor (`id`, `active`,
 * `createdAt`, `passwordHash`…) se descartan.
 */
export const CreateUserInput = z.object({
  email: Email,
  name: UserName,
  role: UserRole,
  departmentIds: DepartmentIds,
  password: NewPassword,
});
/** Alta de usuario ya validada y normalizada (salida del esquema). */
export type CreateUserInput = z.infer<typeof CreateUserInput>;

/**
 * Cuerpo de `PATCH /api/users/:id` (CA-02.8): uno o varios de `email`, `name`, `role` y
 * `departmentIds`, con las mismas validaciones que el alta. La contraseña y el estado activo no se
 * cambian por esta vía: si llegan, se descartan.
 */
export const UpdateUserInput = z
  .object({
    email: Email.optional(),
    name: UserName.optional(),
    role: UserRole.optional(),
    departmentIds: DepartmentIds.optional(),
  })
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    error: 'Indica al menos un campo que cambiar.',
  });
/** Edición de usuario ya validada y normalizada (salida del esquema). */
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

/** Cuerpo de `POST /api/users/:id/password` (CA-02.12). */
export const ResetPasswordInput = z.object({ password: NewPassword });
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

/**
 * Usuario tal como lo ve el Admin en la gestión de usuarios: respuesta de `GET /api/users`,
 * `GET /api/users/:id` y de las mutaciones. `allowedActions` son las acciones que el actor puede
 * hacer sobre este usuario, calculadas por la `AuthorizationPolicy`. Nunca incluye el *hash* de la
 * contraseña: los campos extra se descartan.
 */
export const UserAdmin = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: Role,
  active: z.boolean(),
  departments: z.array(DepartmentSummary),
  createdAt: z.iso.datetime(),
  allowedActions: z.array(UserAction),
});
export type UserAdmin = z.infer<typeof UserAdmin>;
