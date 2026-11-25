import { UpdateUserInput } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import {
  createUserAdminWorld,
  currentUserOf,
  DEPARTMENTS,
  FailingAuditLog,
  IP,
  NOW,
  USERS,
  type UserAdminWorld,
} from './test-fakes';
import { makeUpdateUser, type UpdateUser } from './update-user';

let world: UserAdminWorld;
let updateUser: UpdateUser;

beforeEach(() => {
  world = createUserAdminWorld();
  updateUser = makeUpdateUser(world);
});

const admin = currentUserOf(USERS.admin);
const changes = (value: Record<string, unknown>) => UpdateUserInput.parse(value);

const DEMO_MESSAGE = 'Los usuarios demo no se pueden modificar.';
const SELF_MESSAGE = 'No puedes desactivarte ni quitarte el rol de Admin a ti mismo.';

describe('updateUser', () => {
  it('CA-02.8: cambia nombre, email, rol y departamentos (que sustituyen a los anteriores)', async () => {
    const updated = await updateUser({
      actor: admin,
      id: USERS.worker.id,
      input: changes({
        name: 'Lucía Gómez Prieto',
        email: 'lucia.prieto@incidapp.test',
        role: 'MANAGER',
        departmentIds: [DEPARTMENTS.CAL.id],
      }),
      ip: IP,
    });

    expect(updated).toMatchObject({
      id: USERS.worker.id,
      name: 'Lucía Gómez Prieto',
      email: 'lucia.prieto@incidapp.test',
      role: 'MANAGER',
      active: true,
      departments: [DEPARTMENTS.CAL],
    });
    expect(world.stored(USERS.worker.id)?.passwordHash).toBe(USERS.worker.passwordHash);
  });

  it('CA-02.13: audita USER_UPDATED solo con los campos que cambian (departamentos por código)', async () => {
    await updateUser({
      actor: admin,
      id: USERS.worker.id,
      input: changes({
        name: USERS.worker.name,
        email: USERS.worker.email,
        role: 'MANAGER',
        departmentIds: [DEPARTMENTS.CAL.id, DEPARTMENTS.LOG.id],
      }),
      ip: IP,
    });

    expect(world.auditLog.entries).toEqual([
      {
        actorId: USERS.admin.id,
        action: 'USER_UPDATED',
        entity: 'user',
        entityId: USERS.worker.id,
        before: { role: 'USER', departments: ['LOG'] },
        after: { role: 'MANAGER', departments: ['CAL', 'LOG'] },
        ip: IP,
        createdAt: NOW,
      },
    ]);
  });

  it('CA-02.8: si nada cambia devuelve el usuario sin escribir ni auditar', async () => {
    const result = await updateUser({
      actor: admin,
      id: USERS.worker.id,
      input: changes({
        name: USERS.worker.name,
        email: USERS.worker.email,
        role: USERS.worker.role,
        departmentIds: [DEPARTMENTS.LOG.id],
      }),
      ip: IP,
    });

    expect(result.name).toBe(USERS.worker.name);
    expect(world.unitOfWork.runs).toBe(0);
    expect(world.auditLog.entries).toEqual([]);
  });

  it('CA-02.10: el Admin puede enviar su propio rol sin cambiarlo (solo cuenta lo que cambia)', async () => {
    const result = await updateUser({
      actor: admin,
      id: USERS.admin.id,
      input: changes({ name: 'Marta López Ruiz', role: 'ADMIN' }),
      ip: IP,
    });

    expect(result).toMatchObject({ name: 'Marta López Ruiz', role: 'ADMIN' });
  });

  it('CA-02.10: quitarse el rol de Admin a sí mismo lanza ConflictError y no cambia nada', async () => {
    const error = await updateUser({
      actor: admin,
      id: USERS.admin.id,
      input: changes({ name: 'Otro nombre', role: 'USER' }),
      ip: IP,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ message: SELF_MESSAGE });
    expect(world.stored(USERS.admin.id)).toMatchObject({ role: 'ADMIN', name: USERS.admin.name });
    expect(world.auditLog.entries).toEqual([]);
  });

  it.each([
    ['el email', { email: 'otro@incidapp.test' }],
    ['el rol', { role: 'MANAGER' }],
    ['los departamentos', { departmentIds: [DEPARTMENTS.CAL.id] }],
  ])(
    'CA-02.11: cambiar %s de un usuario demo lanza ConflictError y no cambia nada',
    async (_case, value) => {
      const error = await updateUser({
        actor: admin,
        id: USERS.demoUser.id,
        input: changes({ name: 'Pablo M.', ...value }),
        ip: IP,
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ message: DEMO_MESSAGE });
      expect(world.stored(USERS.demoUser.id)).toEqual(USERS.demoUser);
      expect(world.auditLog.entries).toEqual([]);
    },
  );

  it('CA-02.11: el nombre de un usuario demo sí se puede cambiar', async () => {
    const result = await updateUser({
      actor: admin,
      id: USERS.demoUser.id,
      input: changes({ name: 'Pablo Moreno Gil', email: USERS.demoUser.email }),
      ip: IP,
    });

    expect(result.name).toBe('Pablo Moreno Gil');
  });

  it.each([
    ['de un usuario activo', USERS.manager.email],
    ['de un usuario desactivado', USERS.inactive.email],
  ])('CA-02.8: un email ya registrado (%s) lanza ConflictError', async (_case, email) => {
    const error = await updateUser({
      actor: admin,
      id: USERS.worker.id,
      input: changes({ email }),
      ip: IP,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ message: 'Ya existe un usuario con ese email.' });
    expect(world.auditLog.entries).toEqual([]);
  });

  it('CA-02.8: un departamento que no existe lanza ValidationError', async () => {
    await expect(
      updateUser({
        actor: admin,
        id: USERS.worker.id,
        input: changes({ departmentIds: ['00000000-0000-4000-8000-00000000dddd'] }),
        ip: IP,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('CA-02.6: si el usuario no existe lanza NotFoundError', async () => {
    await expect(
      updateUser({
        actor: admin,
        id: '00000000-0000-4000-8000-00000000ffff',
        input: changes({ name: 'Nadie' }),
        ip: IP,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('CA-02.5: un no-Admin recibe ForbiddenError antes que el 404', async () => {
    await expect(
      updateUser({
        actor: currentUserOf(USERS.manager),
        id: '00000000-0000-4000-8000-00000000ffff',
        input: changes({ name: 'Nadie' }),
        ip: IP,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('CA-02.13: si falla la auditoría no queda el cambio (transacción)', async () => {
    world.unitOfWork.auditLog = new FailingAuditLog();

    await expect(
      updateUser({ actor: admin, id: USERS.worker.id, input: changes({ name: 'X' }), ip: IP }),
    ).rejects.toThrow();

    expect(world.stored(USERS.worker.id)?.name).toBe(USERS.worker.name);
  });
});
