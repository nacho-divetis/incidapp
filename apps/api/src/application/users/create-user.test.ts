import { CreateUserInput } from '@incidapp/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, ValidationError } from '../errors';
import { makeCreateUser, type CreateUser } from './create-user';
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

let world: UserAdminWorld;
let createUser: CreateUser;

beforeEach(() => {
  world = createUserAdminWorld();
  createUser = makeCreateUser(world);
});

const admin = currentUserOf(USERS.admin);
const PASSWORD = 'Clave-Nueva-2026';

const input = (overrides: Partial<CreateUserInput> = {}): CreateUserInput =>
  CreateUserInput.parse({
    email: 'nuevo@incidapp.test',
    name: 'Rosa Navarro',
    role: 'MANAGER',
    departmentIds: [DEPARTMENTS.LOG.id, DEPARTMENTS.CAL.id],
    password: PASSWORD,
    ...overrides,
  });

describe('createUser', () => {
  it('CA-02.7: crea el usuario activo, con el hash de la contraseña, y lo devuelve como UserAdmin', async () => {
    const created = await createUser({ actor: admin, input: input(), ip: IP });

    expect(created).toEqual({
      id: expect.any(String),
      email: 'nuevo@incidapp.test',
      name: 'Rosa Navarro',
      role: 'MANAGER',
      active: true,
      departments: [DEPARTMENTS.CAL, DEPARTMENTS.LOG],
      createdAt: NOW.toISOString(),
      allowedActions: [
        'rename',
        'changeEmail',
        'changeRole',
        'changeDepartments',
        'deactivate',
        'resetPassword',
      ],
    });
    expect(world.stored(created.id)?.passwordHash).toBe(`fake:${PASSWORD}`);
    expect(world.passwordHasher.hashed).toEqual([PASSWORD]);
  });

  it('CA-02.13: audita USER_CREATED con el Admin, el usuario, la IP y after sin contraseña ni hash', async () => {
    const created = await createUser({ actor: admin, input: input(), ip: IP });

    expect(world.auditLog.entries).toEqual([
      {
        actorId: USERS.admin.id,
        action: 'USER_CREATED',
        entity: 'user',
        entityId: created.id,
        before: null,
        after: {
          email: 'nuevo@incidapp.test',
          name: 'Rosa Navarro',
          role: 'MANAGER',
          departments: ['CAL', 'LOG'],
          active: true,
        },
        ip: IP,
        createdAt: NOW,
      },
    ]);
    expect(JSON.stringify(world.auditLog.entries)).not.toMatch(/Clave-Nueva|fake:|password/i);
  });

  it.each([
    ['de un usuario activo', USERS.worker.email],
    ['de un usuario desactivado', USERS.inactive.email],
  ])(
    'CA-02.7: si el email ya está registrado (%s) lanza ConflictError sin crear nada',
    async (_case, email) => {
      const error = await createUser({ actor: admin, input: input({ email }), ip: IP }).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ message: 'Ya existe un usuario con ese email.' });
      expect(world.users.users).toHaveLength(Object.keys(USERS).length);
      expect(world.auditLog.entries).toEqual([]);
      expect(world.passwordHasher.hashed).toEqual([]);
    },
  );

  it('CA-02.7: si algún departamento no existe lanza ValidationError en departmentIds', async () => {
    const error = await createUser({
      actor: admin,
      input: input({ departmentIds: [DEPARTMENTS.LOG.id, '00000000-0000-4000-8000-00000000dddd'] }),
      ip: IP,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      details: [{ path: 'departmentIds', message: 'Alguno de los departamentos no existe.' }],
    });
    expect(world.auditLog.entries).toEqual([]);
  });

  it('CA-02.5: un no-Admin recibe ForbiddenError sin crear nada', async () => {
    await expect(
      createUser({ actor: currentUserOf(USERS.manager), input: input(), ip: IP }),
    ).rejects.toThrow(ForbiddenError);
    expect(world.users.users).toHaveLength(Object.keys(USERS).length);
  });

  it('CA-02.13: si falla la auditoría no queda el usuario (transacción)', async () => {
    world.unitOfWork.auditLog = new FailingAuditLog();

    await expect(createUser({ actor: admin, input: input(), ip: IP })).rejects.toThrow();

    expect(world.users.users.map((user) => user.email)).not.toContain('nuevo@incidapp.test');
  });
});
