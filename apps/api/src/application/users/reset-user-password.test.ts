import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import { makeResetUserPassword, type ResetUserPassword } from './reset-user-password';
import {
  createUserAdminWorld,
  currentUserOf,
  FailingAuditLog,
  IP,
  NOW,
  USERS,
  type UserAdminWorld,
} from './test-fakes';

let world: UserAdminWorld;
let resetUserPassword: ResetUserPassword;

beforeEach(() => {
  world = createUserAdminWorld();
  resetUserPassword = makeResetUserPassword(world);
});

const admin = currentUserOf(USERS.admin);
const PASSWORD = 'Restablecida-2026';

describe('resetUserPassword', () => {
  it('CA-02.12: guarda el hash de la nueva contraseña y borra todas sus sesiones', async () => {
    await world.openSession(USERS.worker.id, 's1');
    await world.openSession(USERS.worker.id, 's2');
    await world.openSession(USERS.manager.id, 's3');

    const result = await resetUserPassword({
      actor: admin,
      id: USERS.worker.id,
      password: PASSWORD,
      ip: IP,
    });

    expect(result).toBeUndefined();
    expect(world.stored(USERS.worker.id)?.passwordHash).toBe(`fake:${PASSWORD}`);
    expect([...world.sessions.sessions.keys()]).toEqual(['s3']);
  });

  it('CA-02.12: también se puede restablecer la de un usuario desactivado y la del propio Admin', async () => {
    await resetUserPassword({ actor: admin, id: USERS.inactive.id, password: PASSWORD, ip: IP });
    await resetUserPassword({ actor: admin, id: USERS.admin.id, password: PASSWORD, ip: IP });

    expect(world.stored(USERS.inactive.id)?.passwordHash).toBe(`fake:${PASSWORD}`);
    expect(world.stored(USERS.admin.id)?.passwordHash).toBe(`fake:${PASSWORD}`);
  });

  it('CA-02.13: audita USER_PASSWORD_RESET sin before/after: nunca la contraseña ni el hash', async () => {
    await resetUserPassword({ actor: admin, id: USERS.worker.id, password: PASSWORD, ip: IP });

    expect(world.auditLog.entries).toEqual([
      {
        actorId: USERS.admin.id,
        action: 'USER_PASSWORD_RESET',
        entity: 'user',
        entityId: USERS.worker.id,
        before: null,
        after: null,
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-02.11: con un usuario demo lanza ConflictError sin calcular el hash ni cambiar nada', async () => {
    await world.openSession(USERS.demoUser.id);

    const error = await resetUserPassword({
      actor: admin,
      id: USERS.demoUser.id,
      password: PASSWORD,
      ip: IP,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ message: 'Los usuarios demo no se pueden modificar.' });
    expect(world.passwordHasher.hashed).toEqual([]);
    expect(world.stored(USERS.demoUser.id)?.passwordHash).toBe(USERS.demoUser.passwordHash);
    expect(world.sessions.sessions.size).toBe(1);
  });

  it('CA-02.6: si el usuario no existe lanza NotFoundError', async () => {
    await expect(
      resetUserPassword({
        actor: admin,
        id: '00000000-0000-4000-8000-00000000ffff',
        password: PASSWORD,
        ip: IP,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('CA-02.5: un no-Admin recibe ForbiddenError sin calcular el hash', async () => {
    await expect(
      resetUserPassword({
        actor: currentUserOf(USERS.worker),
        id: USERS.worker.id,
        password: PASSWORD,
        ip: IP,
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(world.passwordHasher.hashed).toEqual([]);
  });

  it('CA-02.13: si falla la auditoría no cambia la contraseña ni se borran sus sesiones', async () => {
    await world.openSession(USERS.worker.id);
    world.unitOfWork.auditLog = new FailingAuditLog();

    await expect(
      resetUserPassword({ actor: admin, id: USERS.worker.id, password: PASSWORD, ip: IP }),
    ).rejects.toThrow();

    expect(world.stored(USERS.worker.id)?.passwordHash).toBe(USERS.worker.passwordHash);
    expect(world.sessions.sessions.size).toBe(1);
  });
});
