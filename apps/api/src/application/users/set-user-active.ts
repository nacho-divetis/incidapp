import type { CurrentUser, UserAdmin } from '@incidapp/shared';
import type { Clock } from '../ports/clock';
import type { UnitOfWork } from '../ports/unit-of-work';
import type { UserAdminRepository } from '../ports/user-admin-repository';
import {
  assertCanManageUsers,
  findUserOrThrow,
  requireUserAction,
  toUserAdmin,
} from './user-admin-support';

export interface SetUserActiveDeps {
  users: UserAdminRepository;
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export interface SetUserActiveCommand {
  actor: CurrentUser;
  id: string;
  /** `false` para desactivar y `true` para reactivar. */
  active: boolean;
  ip: string | null;
}

export type SetUserActive = (command: SetUserActiveCommand) => Promise<UserAdmin>;

/**
 * `POST /api/users/:id/deactivate` y `/activate` (CA-02.9). Si ya está en ese estado, responde sin
 * cambios ni auditoría (se comprueba antes que la regla: no es un 409). Al desactivar se borran
 * todas sus sesiones, en la misma transacción que el cambio y su auditoría (CA-02.13).
 */
export const makeSetUserActive =
  ({ users, unitOfWork, clock }: SetUserActiveDeps): SetUserActive =>
  async ({ actor, id, active, ip }) => {
    assertCanManageUsers(actor);
    const user = await findUserOrThrow(users, id);
    if (user.active === active) return toUserAdmin(actor, user);
    requireUserAction(actor, user, active ? 'activate' : 'deactivate');

    const now = clock.now();
    const updated = await unitOfWork.run(async (tx) => {
      const result = await tx.users.setActive(user.id, active);
      if (!active) await tx.sessions.deleteAllForUser(user.id);
      await tx.auditLog.record({
        actorId: actor.id,
        action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity: 'user',
        entityId: user.id,
        before: { active: user.active },
        after: { active },
        ip,
        createdAt: now,
      });
      return result;
    });

    return toUserAdmin(actor, updated);
  };
