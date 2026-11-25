import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import { makeSetUserActive, type SetUserActive } from './set-user-active';
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
let setUserActive: SetUserActive;

beforeEach(() => {
  world = createUserAdminWorld();
  setUserActive = makeSetUserActive(world);
});

const admin = currentUserOf(USERS.admin);

describe('setUserActive', () => {
  it('CA-02.9: desactivar deja active: false y borra todas sus sesiones (y solo las suyas)', async () => {
    await world.openSession(USERS.worker.id, 's1');
    await world.openSession(USERS.worker.id, 's2');
    await world.openSession(USERS.manager.id, 's3');

    const result = await setUserActive({
      actor: admin,
      id: USERS.worker.id,
      active: false,
      ip: IP,
    });

    expect(result).toMatchObject({ id: USERS.worker.id, active: false });
    expect(result.allowedActions).toContain('activate');
    expect(result.allowedActions).not.toContain('deactivate');
    expect([...world.sessions.sessions.keys()]).toEqual(['s3']);
  });

  it('CA-02.13: desactivar audita USER_DEACTIVATED con before/after del estado', async () => {
    await setUserActive({ actor: admin, id: USERS.worker.id, active: false, ip: IP });

    expect(world.auditLog.entries).toEqual([
      {
        actorId: USERS.admin.id,
        action: 'USER_DEACTIVATED',
        entity: 'user',
        entityId: USERS.worker.id,
        before: { active: true },
        after: { active: false },
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-02.9: reactivar deja active: true y audita USER_ACTIVATED', async () => {
    const result = await setUserActive({
      actor: admin,
      id: USERS.inactive.id,
      active: true,
      ip: IP,
    });

    expect(result.active).toBe(true);
    expect(world.auditLog.entries).toEqual([
      expect.objectContaining({
        action: 'USER_ACTIVATED',
        entityId: USERS.inactive.id,
        before: { active: false },
        after: { active: true },
      }),
    ]);
  });

  it.each([
    ['desactivar a un desactivado', USERS.inactive.id, false],
    ['activar a un activo', USERS.worker.id, true],
    ['desactivar a un usuario demo ya desactivado', USERS.demoUser.id, false],
  ] as const)('CA-02.9: %s responde sin cambios y sin auditoría', async (_case, id, active) => {
    if (id === USERS.demoUser.id) world.stored(id)!.active = false;

    const result = await setUserActive({ actor: admin, id, active, ip: IP });

    expect(result.active).toBe(active);
    expect(world.unitOfWork.runs).toBe(0);
    expect(world.auditLog.entries).toEqual([]);
  });

  it('CA-02.10: desactivarse a sí mismo lanza ConflictError con el mensaje de la regla', async () => {
    await world.openSession(USERS.admin.id);

    const error = await setUserActive({
      actor: admin,
      id: USERS.admin.id,
      active: false,
      ip: IP,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      message: 'No puedes desactivarte ni quitarte el rol de Admin a ti mismo.',
    });
    expect(world.stored(USERS.admin.id)?.active).toBe(true);
    expect(world.sessions.sessions.size).toBe(1);
  });

  it('CA-02.11: desactivar a un usuario demo lanza ConflictError y no cambia nada', async () => {
    const error = await setUserActive({
      actor: admin,
      id: USERS.demoUser.id,
      active: false,
      ip: IP,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ message: 'Los usuarios demo no se pueden modificar.' });
    expect(world.stored(USERS.demoUser.id)?.active).toBe(true);
  });

  it('CA-02.6: si el usuario no existe lanza NotFoundError', async () => {
    await expect(
      setUserActive({
        actor: admin,
        id: '00000000-0000-4000-8000-00000000ffff',
        active: false,
        ip: IP,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('CA-02.5: un no-Admin recibe ForbiddenError sin cambiar nada', async () => {
    await expect(
      setUserActive({
        actor: currentUserOf(USERS.manager),
        id: USERS.worker.id,
        active: false,
        ip: IP,
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(world.stored(USERS.worker.id)?.active).toBe(true);
  });

  it('CA-02.13: si falla la auditoría no queda desactivado ni se pierden sus sesiones', async () => {
    await world.openSession(USERS.worker.id);
    world.unitOfWork.auditLog = new FailingAuditLog();

    await expect(
      setUserActive({ actor: admin, id: USERS.worker.id, active: false, ip: IP }),
    ).rejects.toThrow();

    expect(world.stored(USERS.worker.id)?.active).toBe(true);
    expect(world.sessions.sessions.size).toBe(1);
  });
});
