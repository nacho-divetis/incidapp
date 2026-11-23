import { asc, eq } from 'drizzle-orm';
import type { UserRepository } from '../../../application/ports/user-repository';
import type { Database } from '../client';
import { departments, userDepartments, users } from '../schema';

/** Adaptador Drizzle de `UserRepository`. */
export function createDrizzleUserRepository(db: Database): UserRepository {
  return {
    async findAccountByEmail(email) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          active: users.active,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },

    async findCurrentUser(id) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          active: users.active,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!row) return null;

      const userDepartmentRows = await db
        .select({ id: departments.id, code: departments.code, name: departments.name })
        .from(userDepartments)
        .innerJoin(departments, eq(departments.id, userDepartments.departmentId))
        .where(eq(userDepartments.userId, id))
        .orderBy(asc(departments.code));

      const { active, ...user } = row;
      return { user: { ...user, departments: userDepartmentRows }, active };
    },
  };
}
