import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError } from '../errors';
import { makeGetUser } from './get-user';
import { makeListUsers } from './list-users';
import { createUserAdminWorld, currentUserOf, USERS, type UserAdminWorld } from './test-fakes';

let world: UserAdminWorld;

beforeEach(() => {
  world = createUserAdminWorld();
});

const admin = currentUserOf(USERS.admin);

describe('listUsers', () => {
  it('CA-02.6: devuelve todos los usuarios, activos y desactivados, ordenados por nombre', async () => {
    const listUsers = makeListUsers({ users: world.users });

    const result = await listUsers(admin);

    expect(result.map((user) => user.name)).toEqual([
      'Andrés Baja',
      'Elena Ruiz',
      'Jorge Sanz',
      'Lucía Gómez',
      'Marta López',
      'Pablo Moreno',
    ]);
    expect(result.find((user) => user.id === USERS.inactive.id)?.active).toBe(false);
  });

  it('CA-02.6: cada usuario va con el formato UserAdmin, sus allowedActions y sin hash', async () => {
    const listUsers = makeListUsers({ users: world.users });

    const result = await listUsers(admin);

    expect(result.find((user) => user.id === USERS.worker.id)).toEqual({
      id: USERS.worker.id,
      email: USERS.worker.email,
      name: USERS.worker.name,
      role: 'USER',
      active: true,
      departments: USERS.worker.departments,
      createdAt: '2026-11-01T09:00:00.000Z',
      allowedActions: [
        'rename',
        'changeEmail',
        'changeRole',
        'changeDepartments',
        'deactivate',
        'resetPassword',
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|fake:/);
  });

  it('CA-02.10: las allowedActions de su propio usuario no incluyen desactivar ni cambiar el rol', async () => {
    const listUsers = makeListUsers({ users: world.users });

    const self = (await listUsers(admin)).find((user) => user.id === USERS.admin.id);

    expect(self?.allowedActions).toEqual([
      'rename',
      'changeEmail',
      'changeDepartments',
      'resetPassword',
    ]);
  });

  it('CA-02.11: las allowedActions de un usuario demo solo incluyen cambiar el nombre', async () => {
    const listUsers = makeListUsers({ users: world.users });

    const demo = (await listUsers(admin)).find((user) => user.id === USERS.demoUser.id);

    expect(demo?.allowedActions).toEqual(['rename']);
  });

  it.each([USERS.manager, USERS.worker])(
    'CA-02.5: un no-Admin ($role) recibe ForbiddenError',
    async (user) => {
      const listUsers = makeListUsers({ users: world.users });

      await expect(listUsers(currentUserOf(user))).rejects.toThrow(ForbiddenError);
    },
  );
});

describe('getUser', () => {
  it('CA-02.6: devuelve el usuario con el mismo formato que el listado', async () => {
    const getUser = makeGetUser({ users: world.users });
    const listed = (await makeListUsers({ users: world.users })(admin)).find(
      (user) => user.id === USERS.inactive.id,
    );

    expect(await getUser(admin, USERS.inactive.id)).toEqual(listed);
  });

  it('CA-02.6: si no existe lanza NotFoundError', async () => {
    const getUser = makeGetUser({ users: world.users });

    await expect(getUser(admin, '00000000-0000-4000-8000-00000000ffff')).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });

  it('CA-02.5: un no-Admin recibe ForbiddenError antes que el 404 (no sabe si el id existe)', async () => {
    const getUser = makeGetUser({ users: world.users });

    await expect(
      getUser(currentUserOf(USERS.worker), '00000000-0000-4000-8000-00000000ffff'),
    ).rejects.toThrow(ForbiddenError);
  });
});
