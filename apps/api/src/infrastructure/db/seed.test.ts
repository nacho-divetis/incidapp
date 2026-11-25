import { DEMO_PASSWORD, DEMO_USERS } from '@incidapp/shared';
import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeLogin } from '../../application/auth/login';
import { createArgon2PasswordHasher } from '../auth/argon2-password-hasher';
import { createSessionTokens } from '../auth/session-tokens';
import { systemClock } from '../clock/system-clock';
import type { DatabaseHandle } from './client';
import { createDrizzleAuditLogWriter } from './repositories/audit-log-writer';
import { createDrizzleSessionRepository } from './repositories/session-repository';
import { createDrizzleUserRepository } from './repositories/user-repository';
import { departments, incidentTypes, userDepartments, users } from './schema';
import { seedDatabase } from './seed';
import { createTestDatabase } from './test-database';

const passwordHasher = createArgon2PasswordHasher();

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = await createTestDatabase();
});

afterEach(async () => {
  await handle.close();
});

const seed = () => seedDatabase(handle.db, { passwordHasher });

const departmentCodes = async () =>
  (
    await handle.db
      .select({ code: departments.code })
      .from(departments)
      .orderBy(asc(departments.code))
  ).map((row) => row.code);

const userRows = () => handle.db.select().from(users).orderBy(asc(users.email));

/** Códigos de departamento de cada usuario, por email. */
async function departmentsByEmail(): Promise<Record<string, string[]>> {
  const rows = await handle.db
    .select({ email: users.email, code: departments.code })
    .from(userDepartments)
    .innerJoin(users, eq(users.id, userDepartments.userId))
    .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
    .orderBy(asc(users.email), asc(departments.code));
  const result: Record<string, string[]> = {};
  for (const { email, code } of rows) (result[email] ??= []).push(code);
  return result;
}

const EXPECTED_CODES = ['ADM', 'ATC', 'CAL', 'COM', 'COMP', 'DIR', 'LOG', 'PROD', 'TEC'];

describe('seedDatabase · departamentos', () => {
  it('CA-00.9: crea los 9 departamentos de la empresa ficticia', async () => {
    await seed();

    expect(await departmentCodes()).toEqual(EXPECTED_CODES);
    const rows = await handle.db.select().from(departments);
    for (const row of rows) expect(row.name.length).toBeGreaterThan(0);
  });

  it('CA-00.9: ejecutarlo dos veces seguidas no duplica ningún departamento', async () => {
    await seed();
    await seed();

    expect(await departmentCodes()).toEqual(EXPECTED_CODES);
  });
});

/** Tipos de incidencia con el código de su dpto. por defecto, por código. */
const incidentTypeRows = async () =>
  (
    await handle.db
      .select({ code: incidentTypes.code, name: incidentTypes.name, department: departments.code })
      .from(incidentTypes)
      .innerJoin(departments, eq(departments.id, incidentTypes.defaultDepartmentId))
      .orderBy(asc(incidentTypes.code))
  ).map(({ code, name, department }) => [code, name, department]);

const EXPECTED_INCIDENT_TYPES = [
  ['ADMINISTRATIVE', 'Administrativa', 'ADM'],
  ['CUSTOMER', 'Cliente / Reclamación', 'ATC'],
  ['INTERNAL', 'Interna / Operativa', 'PROD'],
  ['QUALITY', 'Calidad', 'CAL'],
  ['SUPPLIER', 'Proveedor', 'COMP'],
  ['TECHNICAL', 'Técnica / Instalación', 'TEC'],
  ['TRANSPORT', 'Transporte', 'LOG'],
];

describe('seedDatabase · tipos de incidencia', () => {
  it('CA-03.1: crea los 7 tipos de requisitos.md con su departamento por defecto', async () => {
    await seed();

    expect(await incidentTypeRows()).toEqual(EXPECTED_INCIDENT_TYPES);
  });

  it('CA-03.1: ejecutarlo dos veces no duplica ningún tipo ni cambia sus ids', async () => {
    await seed();
    const before = await handle.db.select().from(incidentTypes).orderBy(asc(incidentTypes.code));

    await seed();

    expect(await handle.db.select().from(incidentTypes).orderBy(asc(incidentTypes.code))).toEqual(
      before,
    );
    expect(await incidentTypeRows()).toEqual(EXPECTED_INCIDENT_TYPES);
  });
});

describe('seedDatabase · usuarios demo', () => {
  it('CA-01.12: crea exactamente cuatro usuarios demo activos, uno por rol, del dominio incidapp.test', async () => {
    await seed();

    const rows = await userRows();
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.role).sort()).toEqual(['ADMIN', 'DIRECTOR', 'MANAGER', 'USER']);
    for (const row of rows) {
      expect(row.active).toBe(true);
      expect(row.email).toMatch(/^[a-z]+@incidapp\.test$/);
    }
    expect(rows.map(({ email, name, role }) => ({ email, name, role }))).toEqual(
      [...DEMO_USERS]
        .sort((a, b) => a.email.localeCompare(b.email))
        .map(({ email, name, role }) => ({ email, name, role })),
    );
  });

  it('CA-01.12: asigna a cada usuario demo sus departamentos', async () => {
    await seed();

    expect(await departmentsByEmail()).toEqual(
      Object.fromEntries(DEMO_USERS.map((user) => [user.email, [...user.departmentCodes].sort()])),
    );
  });

  it('CA-01.11: guarda la contraseña demo como hash argon2id que verifica, nunca en claro', async () => {
    await seed();

    const rows = await userRows();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(row.passwordHash).not.toContain(DEMO_PASSWORD);
      expect(await passwordHasher.verify(row.passwordHash, DEMO_PASSWORD)).toBe(true);
    }
  });

  it('CA-01.12: el segundo seed no duplica usuarios, departamentos asignados ni cambia las contraseñas', async () => {
    await seed();
    const before = await userRows();
    const departmentsBefore = await departmentsByEmail();

    await seed();

    expect(await userRows()).toEqual(before);
    expect(await departmentsByEmail()).toEqual(departmentsBefore);
  });

  it('CA-01.12: no cambia la contraseña de un usuario demo que ya existía', async () => {
    await seed();
    await handle.db
      .update(users)
      .set({ passwordHash: '$argon2id$cambiada' })
      .where(eq(users.email, 'admin@incidapp.test'));

    await seed();

    const [admin] = await handle.db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@incidapp.test'));
    expect(admin?.passwordHash).toBe('$argon2id$cambiada');
  });

  it('CA-01.12: se puede iniciar sesión con cada usuario demo y la contraseña documentada', async () => {
    await seed();
    await seed();
    const login = makeLogin({
      users: createDrizzleUserRepository(handle.db),
      sessions: createDrizzleSessionRepository(handle.db),
      auditLog: createDrizzleAuditLogWriter(handle.db),
      passwordHasher,
      sessionTokens: createSessionTokens(),
      clock: systemClock,
    });

    for (const demo of DEMO_USERS) {
      const { user } = await login({ email: demo.email, password: DEMO_PASSWORD, ip: null });
      expect(user).toMatchObject({ email: demo.email, name: demo.name, role: demo.role });
      expect(user.departments.map((department) => department.code).sort()).toEqual(
        [...demo.departmentCodes].sort(),
      );
    }
  });
});
