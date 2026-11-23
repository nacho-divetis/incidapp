import type { CurrentUser } from '@incidapp/shared';
import type { UserAccount } from '../../domain/auth/user';

/** Usuario actual junto con su estado, que decide si la sesión sigue valiendo. */
export interface CurrentUserRecord {
  user: CurrentUser;
  active: boolean;
}

/** Puerto de lectura de usuarios para la autenticación (tablas `users` y `user_departments`). */
export interface UserRepository {
  /** Busca la cuenta por su email ya normalizado. */
  findAccountByEmail(email: string): Promise<UserAccount | null>;
  /** Usuario con sus departamentos (ordenados por código), o `null` si no existe. */
  findCurrentUser(id: string): Promise<CurrentUserRecord | null>;
}
