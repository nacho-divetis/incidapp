// Comprobaciones de los datos demo en sí (sin base de datos). Que el historial sea coherente con la
// máquina de estados y la política lo garantizan los casos de uso al cargarlo (ver `seed.test.ts`).
import {
  DEMO_USERS,
  INCIDENT_DESCRIPTION_MAX_LENGTH,
  INCIDENT_TITLE_MAX_LENGTH,
} from '@incidapp/shared';
import { describe, expect, it } from 'vitest';
import { DEMO_INCIDENTS, DEMO_STAFF, type DemoMoment } from './demo-incidents';
import { DEPARTMENTS, INCIDENT_TYPES } from './seed';

const minutesAgo = ([daysAgo, time]: DemoMoment): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return daysAgo * 24 * 60 - ((hours ?? 0) * 60 + (minutes ?? 0));
};

const knownEmails = new Set([...DEMO_USERS, ...DEMO_STAFF].map((user) => user.email));

/** Todos los textos libres de los datos demo. */
const texts = [
  ...DEMO_STAFF.map((user) => user.name),
  ...DEMO_INCIDENTS.flatMap((incident) => [
    incident.title,
    incident.description,
    ...incident.steps.flatMap((step) => (step.action === 'transition' ? [step.comment ?? ''] : [])),
  ]),
];

describe('DEMO_STAFF', () => {
  it('CA-07.4: usuarios adicionales ficticios con email .test, distintos de los usuarios demo', () => {
    expect(DEMO_STAFF.length).toBeGreaterThan(0);
    const demoEmails = new Set(DEMO_USERS.map((user) => user.email));
    const departmentCodes = new Set<string>(DEPARTMENTS.map((department) => department.code));
    for (const user of DEMO_STAFF) {
      expect(user.email).toMatch(/^[a-z.]+@incidapp\.test$/);
      expect(demoEmails.has(user.email)).toBe(false);
      expect(['MANAGER', 'USER']).toContain(user.role);
      for (const code of user.departmentCodes) expect(departmentCodes.has(code)).toBe(true);
    }
    expect(new Set(DEMO_STAFF.map((user) => user.email)).size).toBe(DEMO_STAFF.length);
  });
});

describe('DEMO_INCIDENTS', () => {
  it('CA-07.1 y CA-07.3: entre 25 y 40 incidencias, ≥ 2 de cada tipo y como mucho 200 eventos', () => {
    expect(DEMO_INCIDENTS.length).toBeGreaterThanOrEqual(25);
    expect(DEMO_INCIDENTS.length).toBeLessThanOrEqual(40);
    for (const type of INCIDENT_TYPES) {
      expect(
        DEMO_INCIDENTS.filter((incident) => incident.typeCode === type.code).length,
      ).toBeGreaterThanOrEqual(2);
    }
    // Un evento CREATED por incidencia y uno por paso.
    const events = DEMO_INCIDENTS.reduce((total, incident) => total + 1 + incident.steps.length, 0);
    expect(events).toBeLessThanOrEqual(200);
  });

  it('CA-07.3: los títulos no se repiten (son la clave de idempotencia con el creador)', () => {
    const titles = DEMO_INCIDENTS.map((incident) => incident.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('respeta los límites de longitud del alta', () => {
    for (const incident of DEMO_INCIDENTS) {
      expect(incident.title.length).toBeLessThanOrEqual(INCIDENT_TITLE_MAX_LENGTH);
      expect(incident.description.length).toBeLessThanOrEqual(INCIDENT_DESCRIPTION_MAX_LENGTH);
    }
  });

  it('CA-07.2: cada paso es posterior al anterior y todos son de días anteriores al del seed', () => {
    for (const incident of DEMO_INCIDENTS) {
      const moments = [incident.createdAt, ...incident.steps.map((step) => step.at)];
      for (const [daysAgo, time] of moments) {
        expect(daysAgo, incident.title).toBeGreaterThanOrEqual(1);
        expect(time, incident.title).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      }
      const ages = moments.map(minutesAgo);
      for (let i = 1; i < ages.length; i++) {
        expect(ages[i], incident.title).toBeLessThan(ages[i - 1] ?? Infinity);
      }
    }
  });

  it('cada creador, actor y asignado es un usuario demo o un usuario adicional', () => {
    for (const incident of DEMO_INCIDENTS) {
      expect(knownEmails.has(incident.createdBy), incident.createdBy).toBe(true);
      for (const step of incident.steps) {
        expect(knownEmails.has(step.actor), step.actor).toBe(true);
        if (step.action === 'assign') expect(knownEmails.has(step.assignee)).toBe(true);
      }
    }
  });

  it('CA-07.4: ningún texto contiene emails, webs ni teléfonos', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/@|https?:|www\.|\.(com|es|net|org)\b/i);
      expect(text).not.toMatch(/\b\d{9}\b|\+34/);
    }
  });
});
