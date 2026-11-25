// Datos de la empresa ficticia: catálogos, usuarios demo y datos demo (F07). Idempotente: se puede
// ejecutar tantas veces como se quiera y nunca modifica lo que ya existe.
import { randomBytes } from 'node:crypto';
import {
  AssignIncidentInput,
  CreateIncidentInput,
  DEMO_PASSWORD,
  DEMO_USERS,
  TransitionInput,
  type CurrentUser,
} from '@incidapp/shared';
import { inArray } from 'drizzle-orm';
import { globalActionsFor } from '../../application/authorization/authorization-policy';
import { AppError } from '../../application/errors';
import type { AssignIncident } from '../../application/incidents/assign-incident';
import type { ChangeIncidentStatus } from '../../application/incidents/change-incident-status';
import type { CreateIncident } from '../../application/incidents/create-incident';
import type { Clock } from '../../application/ports/clock';
import type { PasswordHasher } from '../../application/ports/password-hasher';
import type { Database } from './client';
import { DEMO_INCIDENTS, DEMO_STAFF, type DemoIncident, type DemoMoment } from './demo-incidents';
import { createDrizzleUserRepository } from './repositories/user-repository';
import { departments, incidents, incidentTypes, userDepartments, users } from './schema';

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

/**
 * Los 7 tipos de incidencia de `docs/requisitos.md`, cada uno con su departamento por defecto
 * (CA-03.1). El código es estable; el nombre visible, en español.
 */
export const INCIDENT_TYPES = [
  { code: 'TRANSPORT', name: 'Transporte', departmentCode: 'LOG' },
  { code: 'SUPPLIER', name: 'Proveedor', departmentCode: 'COMP' },
  { code: 'CUSTOMER', name: 'Cliente / Reclamación', departmentCode: 'ATC' },
  { code: 'QUALITY', name: 'Calidad', departmentCode: 'CAL' },
  { code: 'TECHNICAL', name: 'Técnica / Instalación', departmentCode: 'TEC' },
  { code: 'ADMINISTRATIVE', name: 'Administrativa', departmentCode: 'ADM' },
  { code: 'INTERNAL', name: 'Interna / Operativa', departmentCode: 'PROD' },
] as const;

export interface SeedDeps {
  passwordHasher: PasswordHasher;
}

/**
 * Carga los departamentos, los tipos de incidencia y los usuarios demo de `@incidapp/shared` (uno por rol) con sus
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

    await tx
      .insert(incidentTypes)
      .values(
        INCIDENT_TYPES.map((type) => {
          const departmentId = departmentIds.get(type.departmentCode);
          if (!departmentId) {
            throw new Error(`Seed: no se encuentra el departamento ${type.departmentCode}.`);
          }
          return { code: type.code, name: type.name, defaultDepartmentId: departmentId };
        }),
      )
      .onConflictDoNothing({ target: incidentTypes.code });

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

// ── Datos demo (F07) ──────────────────────────────────────────────────────────────────────────
// Se cargan **una sola vez por base de datos**: si ya hay alguna incidencia, no se hace nada. Y
// nunca tumban el arranque (Render ejecuta el *seed* antes de `npm start`): un fallo se registra
// como aviso y el *seed* termina sin error.

/** Recibe los avisos del *seed* demo (en `db:seed`, la consola). */
export type SeedWarn = (message: string) => void;

export interface DemoStaffSeedDeps extends SeedDeps {
  warn: SeedWarn;
}

/** `true` si la base de datos ya tiene alguna incidencia (demo o creada a mano). */
async function hasIncidents(db: Database): Promise<boolean> {
  const [row] = await db.select({ id: incidents.id }).from(incidents).limit(1);
  return row !== undefined;
}

/** Texto del aviso: el mensaje de los errores de aplicación (en español, sin datos sensibles) y solo el nombre de los demás, porque los de la BD pueden llevar los parámetros de la consulta (p. ej., un hash). */
const messageOf = (error: unknown): string =>
  error instanceof AppError
    ? error.message
    : error instanceof Error
      ? error.name
      : 'error desconocido';

/** Contraseña de un solo uso para un usuario adicional: no se guarda ni se muestra en ningún sitio. */
const unusablePassword = (): string => randomBytes(32).toString('base64url');

/**
 * Crea los usuarios adicionales de los datos demo (`DEMO_STAFF`, decisión 1 de la spec de F07) con
 * una contraseña aleatoria que no se publica: dan actores creíbles a otros departamentos, pero nadie
 * puede entrar con ellos. No hace nada si ya hay incidencias (los datos demo ya se cargaron o la
 * base está en uso); si no, crea solo los que faltan por email y solo a esos les asigna departamentos.
 * Un usuario que ya existe no se toca. Si falla, avisa y no lanza.
 */
export async function seedDemoStaff(
  db: Database,
  { passwordHasher, warn }: DemoStaffSeedDeps,
): Promise<void> {
  try {
    if (await hasIncidents(db)) return;
    const existing = new Set(
      (
        await db
          .select({ email: users.email })
          .from(users)
          .where(
            inArray(
              users.email,
              DEMO_STAFF.map((user) => user.email),
            ),
          )
      ).map((row) => row.email),
    );
    const missing = DEMO_STAFF.filter((user) => !existing.has(user.email));
    if (missing.length === 0) return;

    const newUsers = await Promise.all(
      missing.map(async (user) => ({
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: await passwordHasher.hash(unusablePassword()),
      })),
    );

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values(newUsers)
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id, email: users.email });
      const departmentIds = new Map(
        (await tx.select({ id: departments.id, code: departments.code }).from(departments)).map(
          (row) => [row.code, row.id],
        ),
      );
      const memberships = inserted.flatMap(({ id, email }) =>
        (missing.find((user) => user.email === email)?.departmentCodes ?? []).map((code) => {
          const departmentId = departmentIds.get(code);
          if (!departmentId) throw new Error(`no se encuentra el departamento ${code}.`);
          return { userId: id, departmentId };
        }),
      );
      if (memberships.length > 0) {
        await tx.insert(userDepartments).values(memberships).onConflictDoNothing();
      }
    });
  } catch (error) {
    warn(`Aviso: no se han podido crear los usuarios adicionales de la demo: ${messageOf(error)}`);
  }
}

/** Casos de uso con los que se cargan las incidencias demo. */
export interface DemoIncidentUseCases {
  createIncident: CreateIncident;
  assignIncident: AssignIncident;
  changeIncidentStatus: ChangeIncidentStatus;
}

export interface DemoIncidentSeedDeps {
  /** Momento del *seed*: las fechas de los datos demo se cuentan hacia atrás desde su día. */
  now: Date;
  /**
   * Monta los casos de uso **reales** con el reloj que se le pasa (lo hace el composition root). El
   * *seed* mueve ese reloj a la fecha de cada paso antes de ejecutarlo.
   */
  useCasesWith(clock: Clock): DemoIncidentUseCases;
  warn: SeedWarn;
  /** Incidencias que se cargan; por defecto, `DEMO_INCIDENTS`. */
  incidents?: readonly DemoIncident[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche (UTC) del día de `now`. */
const startOfUtcDay = (now: Date): number =>
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/** Fecha de un momento demo: `daysAgo` días antes del día del *seed*, a la hora `HH:MM` (UTC). */
function dateOf(now: Date, [daysAgo, time]: DemoMoment): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(startOfUtcDay(now) - daysAgo * DAY_MS + (hours * 60 + minutes) * 60_000);
}

/** Fecha objetivo `AAAA-MM-DD`, `days` días después del día del *seed*. */
const dueDateOf = (now: Date, days: number): string =>
  new Date(startOfUtcDay(now) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Carga las incidencias demo (CA-07.1 a CA-07.3) ejecutando, paso a paso, los casos de uso reales
 * (`createIncident`, `assignIncident`, `changeIncidentStatus`) con un reloj guionizado (decisión 2):
 * la máquina de estados, la `AuthorizationPolicy`, los eventos, los códigos del contador y
 * `resolvedAt`/`closedAt` son los de producción por construcción. Se cargan de la más antigua a la
 * más reciente, así los códigos siguen el orden de alta.
 *
 * Una sola vez por base de datos: si ya hay alguna incidencia, no hace nada (aunque después se hayan
 * cambiado títulos, emails o se hayan desactivado usuarios). Si un paso falla (no lo permite la
 * política o la máquina de estados), avisa nombrando la incidencia y el paso, deja esa incidencia
 * como esté y sigue con la siguiente: nunca lanza.
 */
export async function seedDemoIncidents(
  db: Database,
  { now, useCasesWith, warn, incidents: demoIncidents = DEMO_INCIDENTS }: DemoIncidentSeedDeps,
): Promise<void> {
  let typeIds: Map<string, string>;
  try {
    if (await hasIncidents(db)) return;
    typeIds = new Map(
      (await db.select({ id: incidentTypes.id, code: incidentTypes.code }).from(incidentTypes)).map(
        (row) => [row.code, row.id],
      ),
    );
  } catch (error) {
    warn(`Aviso: no se han podido cargar las incidencias demo: ${messageOf(error)}`);
    return;
  }

  let scriptedNow = now;
  const useCases = useCasesWith({ now: () => scriptedNow });

  const userRepository = createDrizzleUserRepository(db);
  const actors = new Map<string, CurrentUser>();
  async function actorByEmail(email: string): Promise<CurrentUser> {
    const cached = actors.get(email);
    if (cached) return cached;
    const account = await userRepository.findAccountByEmail(email);
    const record = account && (await userRepository.findCurrentUser(account.id));
    if (!record) throw new Error(`no existe el usuario ${email}.`);
    const actor = { ...record.user, allowedActions: globalActionsFor(record.user) };
    actors.set(email, actor);
    return actor;
  }

  const oldestFirst = [...demoIncidents].sort(
    (a, b) => dateOf(now, a.createdAt).getTime() - dateOf(now, b.createdAt).getTime(),
  );

  for (const incident of oldestFirst) {
    let stage = 'el alta';
    try {
      const typeId = typeIds.get(incident.typeCode);
      if (!typeId) throw new Error(`no existe el tipo ${incident.typeCode}.`);
      const creator = await actorByEmail(incident.createdBy);
      scriptedNow = dateOf(now, incident.createdAt);
      const { id } = await useCases.createIncident({
        actor: creator,
        input: CreateIncidentInput.parse({
          title: incident.title,
          description: incident.description,
          typeId,
          priority: incident.priority,
          dueDate:
            incident.dueInDays === undefined ? undefined : dueDateOf(now, incident.dueInDays),
        }),
      });

      for (const [index, step] of incident.steps.entries()) {
        stage = `el paso ${index + 1}`;
        const actor = await actorByEmail(step.actor);
        scriptedNow = dateOf(now, step.at);
        if (step.action === 'assign') {
          const assignee = await actorByEmail(step.assignee);
          await useCases.assignIncident({
            actor,
            id,
            input: AssignIncidentInput.parse({ assigneeId: assignee.id }),
          });
        } else {
          await useCases.changeIncidentStatus({
            actor,
            id,
            input: TransitionInput.parse({ to: step.to, comment: step.comment }),
          });
        }
      }
    } catch (error) {
      warn(
        `Aviso: la incidencia demo "${incident.title}" no se ha cargado completa (falla en ${stage}): ${messageOf(error)}`,
      );
    }
  }
}
