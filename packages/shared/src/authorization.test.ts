import { describe, expect, it } from 'vitest';
import { GlobalAction, UserAction } from './index';

describe('GlobalAction', () => {
  it('CA-02.4: define las acciones que no dependen de un recurso', () => {
    expect(GlobalAction.options).toEqual([
      'createIncident',
      'manageUsers',
      'viewAudit',
      'viewDashboard',
    ]);
  });
});

describe('UserAction', () => {
  it('CA-02.10, CA-02.11: define las acciones del Admin sobre un usuario concreto', () => {
    expect(UserAction.options).toEqual([
      'rename',
      'changeEmail',
      'changeRole',
      'changeDepartments',
      'deactivate',
      'activate',
      'resetPassword',
    ]);
  });

  it('rechaza una acción desconocida', () => {
    expect(UserAction.safeParse('delete').success).toBe(false);
  });
});
