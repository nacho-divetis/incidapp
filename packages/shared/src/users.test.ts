import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  CreateUserInput,
  NewPassword,
  ResetPasswordInput,
  UpdateUserInput,
  UserAdmin,
  UserName,
} from './index';

/** Mensajes de error por campo, en el formato en que los recibe la interfaz (`''` = el objeto). */
function fieldErrors(schema: z.ZodType, body: unknown): Record<string, string[]> {
  const result = schema.safeParse(body);
  if (result.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

const LOG_ID = '0b9d8c7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a';
const ADM_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const validCreate = {
  email: 'lucia.gomez@incidapp.test',
  name: 'Lucía Gómez',
  role: 'USER',
  departmentIds: [LOG_ID],
  password: 'Segura2026',
};

describe('UserName', () => {
  it('CA-02.7: quita los espacios de los extremos', () => {
    expect(UserName.parse('  Lucía Gómez  ')).toBe('Lucía Gómez');
  });

  it('CA-02.7: acepta 1 y 100 caracteres y rechaza 101', () => {
    expect(UserName.safeParse('L').success).toBe(true);
    expect(UserName.safeParse('x'.repeat(100)).success).toBe(true);
    expect(UserName.safeParse('x'.repeat(101)).error?.issues[0]?.message).toBe(
      'El nombre no puede tener más de 100 caracteres.',
    );
  });

  it('CA-02.7: el límite se aplica al nombre ya recortado (los espacios no cuentan)', () => {
    expect(UserName.safeParse(`  ${'x'.repeat(100)}  `).success).toBe(true);
  });

  it.each([
    ['vacío', ''],
    ['solo con espacios', '   '],
  ])('CA-02.7: rechaza un nombre %s', (_case, name) => {
    expect(UserName.safeParse(name).error?.issues[0]?.message).toBe('El nombre es obligatorio.');
  });
});

describe('NewPassword', () => {
  it('CA-02.7, CA-02.12: acepta 8 y 200 caracteres', () => {
    expect(NewPassword.safeParse('x'.repeat(8)).success).toBe(true);
    expect(NewPassword.safeParse('x'.repeat(200)).success).toBe(true);
  });

  it('CA-02.7, CA-02.12: rechaza 7 y 201 caracteres con un mensaje en español', () => {
    expect(NewPassword.safeParse('x'.repeat(7)).error?.issues.map((i) => i.message)).toEqual([
      'La contraseña debe tener al menos 8 caracteres.',
    ]);
    expect(NewPassword.safeParse('x'.repeat(201)).error?.issues.map((i) => i.message)).toEqual([
      'La contraseña no puede tener más de 200 caracteres.',
    ]);
  });

  it('CA-02.7: no recorta la contraseña (los espacios cuentan)', () => {
    expect(NewPassword.parse('  abc d  ')).toBe('  abc d  ');
  });

  it('CA-02.7: la contraseña vacía es "obligatoria", con un único mensaje', () => {
    expect(NewPassword.safeParse('').error?.issues.map((i) => i.message)).toEqual([
      'La contraseña es obligatoria.',
    ]);
  });
});

describe('CreateUserInput', () => {
  it('CA-02.7: acepta un alta válida y normaliza el email y el nombre', () => {
    const parsed = CreateUserInput.parse({
      ...validCreate,
      email: '  Lucia.Gomez@IncidApp.TEST ',
      name: ' Lucía Gómez ',
    });

    expect(parsed).toEqual(validCreate);
  });

  it('CA-02.7: acepta varios departamentos distintos', () => {
    expect(
      CreateUserInput.safeParse({ ...validCreate, departmentIds: [LOG_ID, ADM_ID] }).success,
    ).toBe(true);
  });

  it('CA-02.7: descarta los campos que decide el servidor', () => {
    const parsed = CreateUserInput.parse({
      ...validCreate,
      id: '6f1c2a5e-8d3b-4c7a-9e2f-1a2b3c4d5e6f',
      active: false,
      createdAt: '2026-11-23T10:00:00.000Z',
      passwordHash: '$argon2id$v=19$...',
    });

    expect(parsed).toEqual(validCreate);
  });

  it.each([
    ['sin email', { email: undefined }, { email: ['El email es obligatorio.'] }],
    ['con un email mal formado', { email: 'lucia@' }, { email: ['El email no es válido.'] }],
    ['sin nombre', { name: undefined }, { name: ['El nombre es obligatorio.'] }],
    ['con el nombre vacío', { name: '  ' }, { name: ['El nombre es obligatorio.'] }],
    [
      'con un nombre de 101 caracteres',
      { name: 'x'.repeat(101) },
      { name: ['El nombre no puede tener más de 100 caracteres.'] },
    ],
    ['sin rol', { role: undefined }, { role: ['El rol es obligatorio.'] }],
    ['con un rol desconocido', { role: 'ROOT' }, { role: ['El rol no es válido.'] }],
    [
      'sin departamentos',
      { departmentIds: undefined },
      { departmentIds: ['Selecciona al menos un departamento.'] },
    ],
    [
      'con la lista de departamentos vacía',
      { departmentIds: [] },
      { departmentIds: ['Selecciona al menos un departamento.'] },
    ],
    [
      'con un departamento que no es UUID',
      { departmentIds: ['LOG'] },
      { 'departmentIds.0': ['El departamento no es válido.'] },
    ],
    [
      'con departamentos repetidos',
      { departmentIds: [LOG_ID, ADM_ID, LOG_ID] },
      { departmentIds: ['Hay departamentos repetidos.'] },
    ],
    [
      'con departamentos que no son una lista',
      { departmentIds: LOG_ID },
      { departmentIds: ['Los departamentos no son válidos.'] },
    ],
    ['sin contraseña', { password: undefined }, { password: ['La contraseña es obligatoria.'] }],
    [
      'con una contraseña de 7 caracteres',
      { password: 'x'.repeat(7) },
      { password: ['La contraseña debe tener al menos 8 caracteres.'] },
    ],
    [
      'con una contraseña de 201 caracteres',
      { password: 'x'.repeat(201) },
      { password: ['La contraseña no puede tener más de 200 caracteres.'] },
    ],
  ])('CA-02.7: rechaza un alta %s con mensajes en español', (_case, changes, expected) => {
    expect(fieldErrors(CreateUserInput, { ...validCreate, ...changes })).toEqual(expected);
  });

  it('CA-02.7: un alta vacía da un error en español por cada campo obligatorio', () => {
    expect(fieldErrors(CreateUserInput, {})).toEqual({
      email: ['El email es obligatorio.'],
      name: ['El nombre es obligatorio.'],
      role: ['El rol es obligatorio.'],
      departmentIds: ['Selecciona al menos un departamento.'],
      password: ['La contraseña es obligatoria.'],
    });
  });
});

describe('UpdateUserInput', () => {
  it.each([
    ['el nombre', { name: ' Lucía G. ' }, { name: 'Lucía G.' }],
    ['el email', { email: ' LUCIA@incidapp.test' }, { email: 'lucia@incidapp.test' }],
    ['el rol', { role: 'MANAGER' }, { role: 'MANAGER' }],
    ['los departamentos', { departmentIds: [ADM_ID] }, { departmentIds: [ADM_ID] }],
  ])('CA-02.8: acepta cambiar solo %s', (_case, body, expected) => {
    expect(UpdateUserInput.parse(body)).toEqual(expected);
  });

  it('CA-02.8: acepta todos los campos a la vez', () => {
    const { password: _password, ...all } = validCreate;

    expect(UpdateUserInput.parse(all)).toEqual(all);
  });

  it('CA-02.8: aplica las mismas validaciones que el alta', () => {
    expect(
      fieldErrors(UpdateUserInput, {
        email: 'lucia@',
        name: 'x'.repeat(101),
        role: 'ROOT',
        departmentIds: [LOG_ID, LOG_ID],
      }),
    ).toEqual({
      email: ['El email no es válido.'],
      name: ['El nombre no puede tener más de 100 caracteres.'],
      role: ['El rol no es válido.'],
      departmentIds: ['Hay departamentos repetidos.'],
    });
  });

  it('CA-02.8: rechaza dejar al usuario sin departamentos', () => {
    expect(fieldErrors(UpdateUserInput, { departmentIds: [] })).toEqual({
      departmentIds: ['Selecciona al menos un departamento.'],
    });
  });

  it('CA-02.8: rechaza una edición sin ningún campo', () => {
    expect(fieldErrors(UpdateUserInput, {})).toEqual({
      '': ['Indica al menos un campo que cambiar.'],
    });
  });

  it('CA-02.8: la contraseña y el estado activo no se cambian por esta vía (se descartan)', () => {
    expect(UpdateUserInput.parse({ name: 'Lucía', password: 'Segura2026', active: false })).toEqual(
      { name: 'Lucía' },
    );
  });

  it('CA-02.8: una edición con solo campos descartados equivale a una edición vacía', () => {
    expect(
      fieldErrors(UpdateUserInput, { password: 'Segura2026', active: false, id: LOG_ID }),
    ).toEqual({ '': ['Indica al menos un campo que cambiar.'] });
  });
});

describe('ResetPasswordInput', () => {
  it('CA-02.12: acepta una contraseña de 8 a 200 caracteres sin alterarla', () => {
    expect(ResetPasswordInput.parse({ password: ' Segura 2026 ' })).toEqual({
      password: ' Segura 2026 ',
    });
    expect(ResetPasswordInput.safeParse({ password: 'x'.repeat(200) }).success).toBe(true);
  });

  it.each([
    ['sin contraseña', {}, { password: ['La contraseña es obligatoria.'] }],
    [
      'con 7 caracteres',
      { password: 'x'.repeat(7) },
      { password: ['La contraseña debe tener al menos 8 caracteres.'] },
    ],
    [
      'con 201 caracteres',
      { password: 'x'.repeat(201) },
      { password: ['La contraseña no puede tener más de 200 caracteres.'] },
    ],
    [
      'con una contraseña que no es texto',
      { password: 12345678 },
      {
        password: ['La contraseña no es válida.'],
      },
    ],
  ])('CA-02.12: rechaza un restablecimiento %s', (_case, body, expected) => {
    expect(fieldErrors(ResetPasswordInput, body)).toEqual(expected);
  });

  it('CA-02.12: descarta los campos extra', () => {
    expect(ResetPasswordInput.parse({ password: 'Segura2026', userId: LOG_ID })).toEqual({
      password: 'Segura2026',
    });
  });
});

describe('UserAdmin', () => {
  const user = {
    id: '6f1c2a5e-8d3b-4c7a-9e2f-1a2b3c4d5e6f',
    email: 'lucia.gomez@incidapp.test',
    name: 'Lucía Gómez',
    role: 'USER',
    active: true,
    departments: [{ id: LOG_ID, code: 'LOG', name: 'Logística' }],
    createdAt: '2026-11-23T10:00:00.000Z',
    allowedActions: ['rename', 'changeEmail', 'deactivate', 'resetPassword'],
  };

  it('acepta el usuario de la gestión con sus acciones permitidas', () => {
    expect(UserAdmin.parse(user)).toEqual(user);
  });

  it('descarta datos internos como `passwordHash`', () => {
    expect(UserAdmin.parse({ ...user, passwordHash: '$argon2id$v=19$...' })).toEqual(user);
  });

  it.each([
    ['una acción desconocida', { allowedActions: ['delete'] }],
    ['una fecha que no es ISO', { createdAt: '23/11/2026' }],
    ['sin el estado activo', { active: undefined }],
    ['sin acciones permitidas', { allowedActions: undefined }],
  ])('rechaza un usuario con %s', (_case, changes) => {
    expect(UserAdmin.safeParse({ ...user, ...changes }).success).toBe(false);
  });
});
