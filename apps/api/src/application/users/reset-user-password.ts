import type { CurrentUser } from '@incidapp/shared';
import type { Clock } from '../ports/clock';
import type { PasswordHasher } from '../ports/password-hasher';
import type { UnitOfWork } from '../ports/unit-of-work';
import type { UserAdminRepository } from '../ports/user-admin-repository';
import { assertCanManageUsers, findUserOrThrow, requireUserAction } from './user-admin-support';

export interface ResetUserPasswordDeps {
  users: UserAdminRepository;
  unitOfWork: UnitOfWork;
  passwordHasher: PasswordHasher;
  clock: Clock;
}

export interface ResetUserPasswordCommand {
  actor: CurrentUser;
  id: string;
  /** Contraseña nueva ya validada con `ResetPasswordInput`. Nunca se guarda ni se registra. */
  password: string;
  ip: string | null;
}

export type ResetUserPassword = (command: ResetUserPasswordCommand) => Promise<void>;

/**
 * `POST /api/users/:id/password` (CA-02.12): guarda el *hash* de la contraseña nueva y borra todas
 * las sesiones del usuario, junto con un `USER_PASSWORD_RESET` sin `before`/`after` (CA-02.13).
 */
export const makeResetUserPassword =
  ({ users, unitOfWork, passwordHasher, clock }: ResetUserPasswordDeps): ResetUserPassword =>
  async ({ actor, id, password, ip }) => {
    assertCanManageUsers(actor);
    const user = await findUserOrThrow(users, id);
    requireUserAction(actor, user, 'resetPassword');

    const passwordHash = await passwordHasher.hash(password);
    const now = clock.now();
    await unitOfWork.run(async (tx) => {
      await tx.users.setPasswordHash(user.id, passwordHash);
      await tx.sessions.deleteAllForUser(user.id);
      await tx.auditLog.record({
        actorId: actor.id,
        action: 'USER_PASSWORD_RESET',
        entity: 'user',
        entityId: user.id,
        before: null,
        after: null,
        ip,
        createdAt: now,
      });
    });
  };
