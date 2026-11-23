import { z } from 'zod';
import { GlobalAction } from './authorization';

/** Roles de IncidApp (`docs/glosario.md`): Admin, Dirección, Responsable y Usuario. */
export const Role = z.enum(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER']);
export type Role = z.infer<typeof Role>;

/** Departamento resumido, tal como se muestra junto a un usuario. */
export const DepartmentSummary = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
});
export type DepartmentSummary = z.infer<typeof DepartmentSummary>;

/**
 * Usuario con sesión: respuesta de `POST /api/auth/login` y `GET /api/auth/me`.
 * Nunca incluye datos internos (`passwordHash`, `active`…): los campos extra se descartan.
 * `allowedActions` son sus acciones globales, calculadas por la `AuthorizationPolicy` de la API
 * (CA-02.4): la web decide con ellas qué mostrar, sin mirar el rol.
 */
export const CurrentUser = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: Role,
  departments: z.array(DepartmentSummary),
  allowedActions: z.array(GlobalAction),
});
export type CurrentUser = z.infer<typeof CurrentUser>;

/** Longitud máxima de la contraseña: acota el coste del *hash* ante entradas enormes. */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Longitud máxima del email (límite práctico de una dirección, RFC 5321). Acota lo que se guarda en
 * la auditoría, que es solo de inserción y no se puede purgar.
 */
export const EMAIL_MAX_LENGTH = 254;

/**
 * Email de entrada: se normaliza (sin espacios y en minúsculas) antes de validar el formato y la
 * longitud. Lo comparten el login y la gestión de usuarios, así un email se guarda y se busca
 * siempre igual.
 */
export const Email = z
  .string({
    error: (issue) =>
      issue.input === undefined ? 'El email es obligatorio.' : 'El email no es válido.',
  })
  .trim()
  .toLowerCase()
  .min(1, 'El email es obligatorio.')
  .max(EMAIL_MAX_LENGTH, 'El email no es válido.')
  .pipe(z.email('El email no es válido.'));

/**
 * Cuerpo de `POST /api/auth/login`. El email se normaliza (`Email`); la contraseña se acepta tal
 * cual. Los campos que no son `email` ni `password` se descartan: el cliente no decide nada más del
 * usuario (`role`, `active`…).
 */
export const LoginInput = z.object({
  email: Email,
  password: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'La contraseña es obligatoria.' : 'La contraseña no es válida.',
    })
    .min(1, 'La contraseña es obligatoria.')
    .max(
      PASSWORD_MAX_LENGTH,
      `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres.`,
    ),
});
/** Datos de login ya validados y normalizados (salida del esquema). */
export type LoginInput = z.infer<typeof LoginInput>;
