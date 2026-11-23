import { z } from 'zod';

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
 */
export const CurrentUser = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: Role,
  departments: z.array(DepartmentSummary),
});
export type CurrentUser = z.infer<typeof CurrentUser>;

/** Longitud máxima de la contraseña: acota el coste del *hash* ante entradas enormes. */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Cuerpo de `POST /api/auth/login`. El email se normaliza (sin espacios y en minúsculas) antes de
 * validar el formato; la contraseña se acepta tal cual. Los campos que no son `email` ni
 * `password` se descartan: el cliente no decide nada más del usuario (`role`, `active`…).
 */
export const LoginInput = z.object({
  email: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'El email es obligatorio.' : 'El email no es válido.',
    })
    .trim()
    .toLowerCase()
    .min(1, 'El email es obligatorio.')
    .pipe(z.email('El email no es válido.')),
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
