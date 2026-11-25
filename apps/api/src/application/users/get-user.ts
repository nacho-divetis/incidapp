import type { CurrentUser, UserAdmin } from '@incidapp/shared';
import type { UserAdminRepository } from '../ports/user-admin-repository';
import { assertCanManageUsers, findUserOrThrow, toUserAdmin } from './user-admin-support';

export interface GetUserDeps {
  users: UserAdminRepository;
}

export type GetUser = (actor: CurrentUser, id: string) => Promise<UserAdmin>;

/** `GET /api/users/:id` (CA-02.6): 403 si no es Admin; 404 si no existe. */
export const makeGetUser =
  ({ users }: GetUserDeps): GetUser =>
  async (actor, id) => {
    assertCanManageUsers(actor);
    return toUserAdmin(actor, await findUserOrThrow(users, id));
  };
