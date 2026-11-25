import type { CreateUserInput, CurrentUser, UserAdmin } from '@incidapp/shared';
import { ConflictError } from '../errors';
import type { Clock } from '../ports/clock';
import type { DepartmentRepository } from '../ports/department-repository';
import type { PasswordHasher } from '../ports/password-hasher';
import type { UnitOfWork } from '../ports/unit-of-work';
import type { UserAdminRepository } from '../ports/user-admin-repository';
import {
  assertCanManageUsers,
  departmentCodes,
  findDepartmentsOrThrow,
  toUserAdmin,
} from './user-admin-support';
import { EMAIL_TAKEN_MESSAGE } from './user-messages';

export interface CreateUserDeps {
  users: UserAdminRepository;
  departments: DepartmentRepository;
  unitOfWork: UnitOfWork;
  passwordHasher: PasswordHasher;
  clock: Clock;
}

export interface CreateUserCommand {
  actor: CurrentUser;
  /** Alta ya validada y normalizada con `CreateUserInput`. */
  input: CreateUserInput;
  /** IP del cliente para la auditoría, si se conoce. */
  ip: string | null;
}

export type CreateUser = (command: CreateUserCommand) => Promise<UserAdmin>;

/**
 * `POST /api/users` (CA-02.7): comprueba los departamentos y que el email esté libre (también entre
 * los desactivados), calcula el *hash* fuera de la transacción y guarda el usuario junto con su
 * `USER_CREATED` (CA-02.13).
 */
export const makeCreateUser =
  ({ users, departments, unitOfWork, passwordHasher, clock }: CreateUserDeps): CreateUser =>
  async ({ actor, input, ip }) => {
    assertCanManageUsers(actor);
    const userDepartments = await findDepartmentsOrThrow(departments, input.departmentIds);
    if (await users.findByEmail(input.email)) throw new ConflictError(EMAIL_TAKEN_MESSAGE);

    const passwordHash = await passwordHasher.hash(input.password);
    const now = clock.now();

    const created = await unitOfWork.run(async (tx) => {
      const user = await tx.users.create({
        email: input.email,
        name: input.name,
        role: input.role,
        departmentIds: input.departmentIds,
        passwordHash,
        createdAt: now,
      });
      await tx.auditLog.record({
        actorId: actor.id,
        action: 'USER_CREATED',
        entity: 'user',
        entityId: user.id,
        before: null,
        after: {
          email: user.email,
          name: user.name,
          role: user.role,
          departments: departmentCodes(userDepartments),
          active: user.active,
        },
        ip,
        createdAt: now,
      });
      return user;
    });

    return toUserAdmin(actor, created);
  };
