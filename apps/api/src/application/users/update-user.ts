import type { CurrentUser, UpdateUserInput, UserAction, UserAdmin } from '@incidapp/shared';
import { ConflictError } from '../errors';
import type { AuditData } from '../ports/audit-log-writer';
import type { Clock } from '../ports/clock';
import type { DepartmentRepository } from '../ports/department-repository';
import type { UnitOfWork } from '../ports/unit-of-work';
import type { ManagedUser, UserAdminRepository, UserChanges } from '../ports/user-admin-repository';
import {
  assertCanManageUsers,
  departmentCodes,
  findDepartmentsOrThrow,
  findUserOrThrow,
  requireUserAction,
  toUserAdmin,
} from './user-admin-support';
import { EMAIL_TAKEN_MESSAGE } from './user-messages';

export interface UpdateUserDeps {
  users: UserAdminRepository;
  departments: DepartmentRepository;
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export interface UpdateUserCommand {
  actor: CurrentUser;
  id: string;
  /** Edición ya validada y normalizada con `UpdateUserInput`. */
  input: UpdateUserInput;
  ip: string | null;
}

export type UpdateUser = (command: UpdateUserCommand) => Promise<UserAdmin>;

/** Lo que cambia de verdad respecto al usuario guardado y la `UserAction` que pide cada campo. */
interface Diff {
  changes: UserChanges;
  required: UserAction[];
  before: AuditData;
  after: AuditData;
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

function diffOf(user: ManagedUser, input: UpdateUserInput): Diff {
  const diff: Diff = { changes: {}, required: [], before: {}, after: {} };
  if (input.name !== undefined && input.name !== user.name) {
    diff.changes.name = input.name;
    diff.required.push('rename');
    diff.before.name = user.name;
    diff.after.name = input.name;
  }
  if (input.email !== undefined && input.email !== user.email) {
    diff.changes.email = input.email;
    diff.required.push('changeEmail');
    diff.before.email = user.email;
    diff.after.email = input.email;
  }
  if (input.role !== undefined && input.role !== user.role) {
    diff.changes.role = input.role;
    diff.required.push('changeRole');
    diff.before.role = user.role;
    diff.after.role = input.role;
  }
  const currentIds = user.departments.map((department) => department.id);
  if (input.departmentIds !== undefined && !sameIds(input.departmentIds, currentIds)) {
    diff.changes.departmentIds = input.departmentIds;
    diff.required.push('changeDepartments');
    // Los códigos de `after` se rellenan tras comprobar que los departamentos existen.
    diff.before.departments = departmentCodes(user.departments);
  }
  return diff;
}

/**
 * `PATCH /api/users/:id` (CA-02.8). Solo cuenta lo que cambia: cada campo distinto pide su
 * `UserAction` (409 con el mensaje de la regla si falta, CA-02.10, CA-02.11) y se audita con
 * `before`/`after` de esos campos (CA-02.13). Si nada cambia, devuelve el usuario sin escribir.
 */
export const makeUpdateUser =
  ({ users, departments, unitOfWork, clock }: UpdateUserDeps): UpdateUser =>
  async ({ actor, id, input, ip }) => {
    assertCanManageUsers(actor);
    const user = await findUserOrThrow(users, id);

    const { changes, required, before, after } = diffOf(user, input);
    if (required.length === 0) return toUserAdmin(actor, user);
    for (const action of required) requireUserAction(actor, user, action);

    if (changes.departmentIds !== undefined) {
      const found = await findDepartmentsOrThrow(departments, changes.departmentIds);
      after.departments = departmentCodes(found);
    }
    if (changes.email !== undefined) {
      const owner = await users.findByEmail(changes.email);
      if (owner && owner.id !== user.id) throw new ConflictError(EMAIL_TAKEN_MESSAGE);
    }

    const now = clock.now();
    const updated = await unitOfWork.run(async (tx) => {
      const result = await tx.users.update(user.id, changes);
      await tx.auditLog.record({
        actorId: actor.id,
        action: 'USER_UPDATED',
        entity: 'user',
        entityId: user.id,
        before,
        after,
        ip,
        createdAt: now,
      });
      return result;
    });

    return toUserAdmin(actor, updated);
  };
