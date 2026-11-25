import type { CurrentUser, UserAdmin } from '@incidapp/shared';
import type { UserAdminRepository } from '../ports/user-admin-repository';
import { assertCanManageUsers, toUserAdmin } from './user-admin-support';

export interface ListUsersDeps {
  users: UserAdminRepository;
}

export type ListUsers = (actor: CurrentUser) => Promise<UserAdmin[]>;

/** `GET /api/users`: todos los usuarios, activos y desactivados, ordenados por nombre (CA-02.6). */
export const makeListUsers =
  ({ users }: ListUsersDeps): ListUsers =>
  async (actor) => {
    assertCanManageUsers(actor);
    return (await users.list()).map((user) => toUserAdmin(actor, user));
  };
