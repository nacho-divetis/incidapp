import type { DepartmentSummary } from '@incidapp/shared';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import { ConflictError } from '../../../application/errors';
import type {
  ManagedUser,
  UserAdminRepository,
} from '../../../application/ports/user-admin-repository';
import { EMAIL_TAKEN_MESSAGE } from '../../../application/users/user-messages';
import type { Database } from '../client';
import { departments, userDepartments, users } from '../schema';
import { sortByName } from './spanish-order';
import { isUuid } from './uuid';

/** Código de Postgres (y PGlite) para la violación de un índice único. */
const UNIQUE_VIOLATION = '23505';

/** ¿Es (o envuelve, como `DrizzleQueryError`) una violación de un índice único? */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Ejecuta una escritura traduciendo la violación del índice único de `users.email` a `ConflictError`
 * (dos altas con el mismo email a la vez, CA-02.7). `users.email` es el único índice único que
 * tocan estas escrituras (la clave de `user_departments` no se repite: se borra antes).
 */
async function translatingEmailConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError(EMAIL_TAKEN_MESSAGE);
    throw error;
  }
}

const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
};

/**
 * Adaptador Drizzle de `UserAdminRepository`. Recibe la base de datos o una transacción
 * (`UnitOfWork`). Nunca devuelve el *hash* de la contraseña.
 */
export function createDrizzleUserAdminRepository(db: Database): UserAdminRepository {
  /** Usuarios que cumplen `where`, ordenados por nombre, con sus departamentos (por código). */
  async function select(where?: SQL): Promise<ManagedUser[]> {
    const rows = await db
      .select(userColumns)
      .from(users)
      .where(where)
      .orderBy(asc(users.name), asc(users.email));
    if (rows.length === 0) return [];

    const memberships = await db
      .select({
        userId: userDepartments.userId,
        id: departments.id,
        code: departments.code,
        name: departments.name,
      })
      .from(userDepartments)
      .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
      .where(
        inArray(
          userDepartments.userId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(departments.code));

    const byUser = new Map<string, DepartmentSummary[]>();
    for (const { userId, ...department } of memberships) {
      byUser.set(userId, [...(byUser.get(userId) ?? []), department]);
    }
    return rows.map((row) => ({ ...row, departments: byUser.get(row.id) ?? [] }));
  }

  async function findById(id: string): Promise<ManagedUser | null> {
    // Un id que no es un UUID no existe (Postgres rechazaría la consulta): 404, no 500 (CA-02.6).
    if (!isUuid(id)) return null;
    const [user] = await select(eq(users.id, id));
    return user ?? null;
  }

  async function getById(id: string): Promise<ManagedUser> {
    const user = await findById(id);
    if (!user) throw new Error(`No existe el usuario ${id}`);
    return user;
  }

  async function replaceDepartments(userId: string, departmentIds: readonly string[]) {
    await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
    if (departmentIds.length > 0) {
      await db
        .insert(userDepartments)
        .values(departmentIds.map((departmentId) => ({ userId, departmentId })));
    }
  }

  return {
    list: () => select(),

    findById,

    async findByEmail(email) {
      const [user] = await select(eq(users.email, email));
      return user ?? null;
    },

    async create(data) {
      const [row] = await translatingEmailConflict(() =>
        db
          .insert(users)
          .values({
            email: data.email,
            name: data.name,
            role: data.role,
            passwordHash: data.passwordHash,
            createdAt: data.createdAt,
          })
          .returning({ id: users.id }),
      );
      if (!row) throw new Error('No se ha insertado el usuario');
      await replaceDepartments(row.id, data.departmentIds);
      return getById(row.id);
    },

    async update(id, changes) {
      const { departmentIds, ...fields } = changes;
      if (Object.keys(fields).length > 0) {
        await translatingEmailConflict(() => db.update(users).set(fields).where(eq(users.id, id)));
      }
      if (departmentIds !== undefined) await replaceDepartments(id, departmentIds);
      return getById(id);
    },

    async setActive(id, active) {
      await db.update(users).set({ active }).where(eq(users.id, id));
      return getById(id);
    },

    async setPasswordHash(id, passwordHash) {
      await db.update(users).set({ passwordHash }).where(eq(users.id, id));
    },

    async listActiveByDepartment(departmentId) {
      const rows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .innerJoin(userDepartments, eq(userDepartments.userId, users.id))
        .where(and(eq(userDepartments.departmentId, departmentId), eq(users.active, true)));
      return sortByName(rows);
    },
  };
}
