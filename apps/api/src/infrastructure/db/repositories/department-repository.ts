import { asc, inArray } from 'drizzle-orm';
import type { DepartmentRepository } from '../../../application/ports/department-repository';
import type { Database } from '../client';
import { departments } from '../schema';

const columns = { id: departments.id, code: departments.code, name: departments.name };

/** Adaptador Drizzle de `DepartmentRepository`. */
export function createDrizzleDepartmentRepository(db: Database): DepartmentRepository {
  return {
    list() {
      return db.select(columns).from(departments).orderBy(asc(departments.name));
    },

    async findByIds(ids) {
      if (ids.length === 0) return [];
      return db
        .select(columns)
        .from(departments)
        .where(inArray(departments.id, [...ids]))
        .orderBy(asc(departments.code));
    },
  };
}
