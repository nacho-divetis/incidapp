import type { IncidentTypeSummary } from '@incidapp/shared';
import { eq } from 'drizzle-orm';
import type { IncidentTypeRepository } from '../../../application/ports/incident-type-repository';
import type { Database } from '../client';
import { departments, incidentTypes } from '../schema';
import { sortByName } from './spanish-order';
import { isUuid } from './uuid';

const columns = {
  id: incidentTypes.id,
  code: incidentTypes.code,
  name: incidentTypes.name,
  departmentId: departments.id,
  departmentCode: departments.code,
  departmentName: departments.name,
};

const toSummary = (row: {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
}): IncidentTypeSummary => ({
  id: row.id,
  code: row.code,
  name: row.name,
  department: { id: row.departmentId, code: row.departmentCode, name: row.departmentName },
});

/** Adaptador Drizzle de `IncidentTypeRepository`. */
export function createDrizzleIncidentTypeRepository(db: Database): IncidentTypeRepository {
  const select = () =>
    db
      .select(columns)
      .from(incidentTypes)
      .innerJoin(departments, eq(departments.id, incidentTypes.defaultDepartmentId));

  return {
    async list() {
      return sortByName((await select()).map(toSummary));
    },

    async findById(id) {
      if (!isUuid(id)) return null;
      const [row] = await select().where(eq(incidentTypes.id, id));
      return row ? toSummary(row) : null;
    },
  };
}
