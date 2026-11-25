import { describe, expect, it } from 'vitest';
import { DEPARTMENTS, InMemoryDepartments } from '../users/test-fakes';
import { makeListDepartments } from './list-departments';

describe('listDepartments', () => {
  it('CA-02.14: devuelve el catálogo de departamentos ordenado por nombre', async () => {
    const listDepartments = makeListDepartments({ departments: new InMemoryDepartments() });

    expect(await listDepartments()).toEqual([DEPARTMENTS.ADM, DEPARTMENTS.CAL, DEPARTMENTS.LOG]);
  });
});
