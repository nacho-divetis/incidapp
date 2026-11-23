// Datos mínimos de la empresa ficticia. Idempotente: se puede ejecutar tantas veces como se quiera.
import { DEMO_PASSWORD, DEMO_USERS } from '@incidapp/shared';
import { inArray } from 'drizzle-orm';
import type { PasswordHasher } from '../../application/ports/password-hasher';
import type { Database } from './client';
import { departments, userDepartments, users } from './schema';

/** Los 9 departamentos de la empresa ficticia (ver `docs/requisitos.md`). */
export const DEPARTMENTS = [
  { code: 'DIR', name: 'Dirección' },
  { code: 'ADM', name: 'Administración y Finanzas' },
  { code: 'COM', name: 'Comercial' },
  { code: 'ATC', name: 'Atención al Cliente / Postventa' },
  { code: 'COMP', name: 'Compras' },
  { code: 'LOG', name: 'Logística y Almacén' },
  { code: 'PROD', name: 'Producción / Operaciones' },
  { code: 'TEC', name: 'Departamento Técnico' },
  { code: 'CAL', name: 'Calidad' },
] as const;

export interface SeedDeps {
  passwordHasher: PasswordHasher;
}

/**
 * Carga los departamentos y los usuarios demo de `@incidapp/shared` (uno por rol) con sus
 * departamentos. Lo que ya existe no se toca: un usuario demo existente conserva su contraseña.
 */
export async function seedDatabase(db: Database, { passwordHasher }: SeedDeps): Promise<void> {
  const demoEmails = DEMO_USERS.map((user) => user.email);
  const existing = new Set(
    (
      await db.select({ email: users.email }).from(users).where(inArray(users.email, demoEmails))
    ).map((row) => row.email),
  );

  // Solo se calcula el hash (caro a propósito) de los usuarios que faltan. Cada uno con su sal.
  const newUsers = await Promise.all(
    DEMO_USERS.filter((user) => !existing.has(user.email)).map(async (user) => ({
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: await passwordHasher.hash(DEMO_PASSWORD),
    })),
  );

  await db.transaction(async (tx) => {
    await tx
      .insert(departments)
      .values([...DEPARTMENTS])
      .onConflictDoNothing({ target: departments.code });

    if (newUsers.length > 0) {
      await tx.insert(users).values(newUsers).onConflictDoNothing({ target: users.email });
    }

    const userIds = new Map(
      (
        await tx
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.email, demoEmails))
      ).map((row) => [row.email, row.id]),
    );
    const departmentIds = new Map(
      (await tx.select({ id: departments.id, code: departments.code }).from(departments)).map(
        (row) => [row.code, row.id],
      ),
    );

    const memberships = DEMO_USERS.flatMap((user) =>
      user.departmentCodes.map((code) => {
        const userId = userIds.get(user.email);
        const departmentId = departmentIds.get(code);
        if (!userId || !departmentId) {
          throw new Error(
            `Seed: no se encuentra el usuario ${user.email} o el departamento ${code}.`,
          );
        }
        return { userId, departmentId };
      }),
    );
    await tx.insert(userDepartments).values(memberships).onConflictDoNothing();
  });
}
