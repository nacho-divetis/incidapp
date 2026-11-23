import { describe, expect, it } from 'vitest';
import {
  CurrentUser,
  DEMO_PASSWORD,
  DEMO_USERS,
  DepartmentSummary,
  EMAIL_MAX_LENGTH,
  LoginInput,
  Role,
} from './index';

/** Mensajes de error de `LoginInput` por campo, en el formato en que los recibe la interfaz. */
function loginErrors(body: unknown): Record<string, string[]> {
  const result = LoginInput.safeParse(body);
  if (result.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.');
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

describe('LoginInput', () => {
  it('CA-01.1: normaliza el email quitando los espacios y pasándolo a minúsculas', () => {
    const parsed = LoginInput.parse({ email: '  Admin@IncidApp.TEST ', password: 'Demo2026!' });

    expect(parsed).toEqual({ email: 'admin@incidapp.test', password: 'Demo2026!' });
  });

  it('CA-01.1: no altera la contraseña (ni espacios ni mayúsculas)', () => {
    const parsed = LoginInput.parse({ email: 'admin@incidapp.test', password: '  Demo 2026!  ' });

    expect(parsed.password).toBe('  Demo 2026!  ');
  });

  it('CA-01.3: descarta los campos que no son email ni password', () => {
    const parsed = LoginInput.parse({
      email: 'admin@incidapp.test',
      password: 'Demo2026!',
      role: 'ADMIN',
      active: true,
    });

    expect(parsed).toEqual({ email: 'admin@incidapp.test', password: 'Demo2026!' });
  });

  it('CA-01.3: acepta una contraseña de 1 carácter y una de 200', () => {
    expect(LoginInput.safeParse({ email: 'a@incidapp.test', password: 'x' }).success).toBe(true);
    expect(
      LoginInput.safeParse({ email: 'a@incidapp.test', password: 'x'.repeat(200) }).success,
    ).toBe(true);
  });

  it('CA-01.3: acepta un email de 254 caracteres y rechaza uno de 255', () => {
    const DOMAIN = '@incidapp.test';
    const emailOf = (length: number) => `${'a'.repeat(length - DOMAIN.length)}${DOMAIN}`;
    expect(EMAIL_MAX_LENGTH).toBe(254);

    expect(LoginInput.safeParse({ email: emailOf(254), password: 'x' }).success).toBe(true);
    expect(loginErrors({ email: emailOf(255), password: 'x' })).toEqual({
      email: ['El email no es válido.'],
    });
  });

  it('CA-01.3: el límite se aplica al email ya normalizado (los espacios no cuentan)', () => {
    const email = `${'a'.repeat(240)}@incidapp.test`;

    expect(LoginInput.safeParse({ email: `  ${email}  `, password: 'x' }).success).toBe(true);
  });

  it.each([
    ['sin email', { password: 'Demo2026!' }, { email: ['El email es obligatorio.'] }],
    [
      'con el email vacío',
      { email: '', password: 'Demo2026!' },
      { email: ['El email es obligatorio.'] },
    ],
    [
      'con el email solo con espacios',
      { email: '   ', password: 'Demo2026!' },
      { email: ['El email es obligatorio.'] },
    ],
    [
      'con un email mal formado',
      { email: 'admin@', password: 'Demo2026!' },
      { email: ['El email no es válido.'] },
    ],
    [
      'con un email que no es texto',
      { email: 42, password: 'Demo2026!' },
      { email: ['El email no es válido.'] },
    ],
    [
      'sin contraseña',
      { email: 'admin@incidapp.test' },
      { password: ['La contraseña es obligatoria.'] },
    ],
    [
      'con la contraseña vacía',
      { email: 'admin@incidapp.test', password: '' },
      { password: ['La contraseña es obligatoria.'] },
    ],
    [
      'con una contraseña de más de 200 caracteres',
      { email: 'admin@incidapp.test', password: 'x'.repeat(201) },
      { password: ['La contraseña no puede tener más de 200 caracteres.'] },
    ],
    [
      'con el cuerpo vacío',
      {},
      { email: ['El email es obligatorio.'], password: ['La contraseña es obligatoria.'] },
    ],
  ])('CA-01.3: rechaza un login %s con mensajes en español por campo', (_case, body, expected) => {
    expect(loginErrors(body)).toEqual(expected);
  });

  it('CA-01.3: rechaza un cuerpo que no es un objeto', () => {
    expect(LoginInput.safeParse('admin@incidapp.test').success).toBe(false);
    expect(LoginInput.safeParse(null).success).toBe(false);
  });
});

describe('Role', () => {
  it('define los cuatro roles del glosario', () => {
    expect(Role.options).toEqual(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER']);
  });
});

describe('CurrentUser', () => {
  const user = {
    id: '6f1c2a5e-8d3b-4c7a-9e2f-1a2b3c4d5e6f',
    email: 'admin@incidapp.test',
    name: 'Elena Ruiz',
    role: 'ADMIN',
    departments: [
      {
        id: '0b9d8c7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a',
        code: 'ADM',
        name: 'Administración y Finanzas',
      },
    ],
    allowedActions: ['createIncident', 'manageUsers', 'viewAudit', 'viewDashboard'],
  };

  it('CA-01.1: acepta el usuario actual con su rol y sus departamentos', () => {
    expect(CurrentUser.parse(user)).toEqual(user);
  });

  it('CA-02.4: acepta una lista vacía de acciones globales', () => {
    expect(CurrentUser.parse({ ...user, allowedActions: [] }).allowedActions).toEqual([]);
  });

  it('CA-01.1: descarta los datos internos como `passwordHash` o `active`', () => {
    const parsed = CurrentUser.parse({ ...user, passwordHash: '$argon2id$v=19$...', active: true });

    expect(parsed).toEqual(user);
    expect(parsed).not.toHaveProperty('passwordHash');
  });

  it.each([
    ['un rol desconocido', { ...user, role: 'ROOT' }],
    ['un id que no es UUID', { ...user, id: '1' }],
    ['sin departamentos', { ...user, departments: undefined }],
    ['un nombre vacío', { ...user, name: '' }],
    ['sin acciones permitidas', { ...user, allowedActions: undefined }],
    ['una acción global desconocida', { ...user, allowedActions: ['deleteEverything'] }],
  ])('rechaza un usuario con %s', (_case, body) => {
    expect(CurrentUser.safeParse(body).success).toBe(false);
  });

  it('DepartmentSummary exige id, código y nombre', () => {
    expect(DepartmentSummary.safeParse({ id: user.departments[0]?.id, code: 'ADM' }).success).toBe(
      false,
    );
  });
});

describe('DEMO_USERS', () => {
  it('CA-01.12: hay exactamente un usuario demo por rol', () => {
    expect(DEMO_USERS.map((demo) => demo.role).sort()).toEqual([...Role.options].sort());
  });

  it('CA-01.12: coinciden con los usuarios demo del plan', () => {
    expect(DEMO_USERS).toEqual([
      { email: 'admin@incidapp.test', name: 'Elena Ruiz', role: 'ADMIN', departmentCodes: ['ADM'] },
      {
        email: 'direccion@incidapp.test',
        name: 'Javier Ortega',
        role: 'DIRECTOR',
        departmentCodes: ['DIR'],
      },
      {
        email: 'responsable@incidapp.test',
        name: 'Carmen Vidal',
        role: 'MANAGER',
        departmentCodes: ['LOG'],
      },
      {
        email: 'usuario@incidapp.test',
        name: 'Pablo Moreno',
        role: 'USER',
        departmentCodes: ['LOG'],
      },
    ]);
  });

  it('CA-01.12: usan el dominio reservado incidapp.test y emails ya normalizados', () => {
    for (const demo of DEMO_USERS) {
      expect(demo.email).toMatch(/@incidapp\.test$/);
      expect(LoginInput.parse({ email: demo.email, password: DEMO_PASSWORD }).email).toBe(
        demo.email,
      );
    }
  });

  it('CA-01.12: la contraseña demo documentada es `Demo2026!`', () => {
    expect(DEMO_PASSWORD).toBe('Demo2026!');
  });
});
