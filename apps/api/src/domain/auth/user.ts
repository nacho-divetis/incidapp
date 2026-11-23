// Cuenta de usuario tal como la necesita la autenticación. TypeScript puro.

/** Roles de IncidApp. Debe coincidir con `Role` de `@incidapp/shared` (lo comprueba `user.test.ts`). */
export type UserRole = 'ADMIN' | 'DIRECTOR' | 'MANAGER' | 'USER';

/** Cuenta con sus credenciales. Uso interno: nunca sale de la API (no es `CurrentUser`). */
export interface UserAccount {
  id: string;
  /** Email normalizado (ver `normalizeEmail`). */
  email: string;
  name: string;
  role: UserRole;
  /** Un usuario desactivado no puede iniciar sesión y sus sesiones dejan de valer (`docs/permisos.md`). */
  active: boolean;
  /** Hash argon2id de la contraseña. */
  passwordHash: string;
}

/** Forma canónica de un email: sin espacios al principio ni al final y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
