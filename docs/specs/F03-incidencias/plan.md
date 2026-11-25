# F03 · Incidencias — Plan

- **Estado:** borrador · no requiere aprobación (solo F00 y F02 la exigen); falta el visto bueno a la rama única (ver **Riesgos y decisiones**)
- **Spec:** `spec.md` (aprobada el 25/11)

## Contrato (`packages/shared`)

Archivo nuevo `packages/shared/src/incidents.ts` (exportado desde `index.ts`). Mensajes de validación en español; objetos no estrictos (los campos extra se descartan, CA-03.2 y CA-03.9).

| Esquema / constante | Uso |
|---|---|
| `Priority` | `z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])` (`docs/glosario.md`) |
| `IncidentEventType` | `z.enum(['CREATED', 'UPDATED', 'ASSIGNED', 'STATUS_CHANGED'])`. Se define entero en F03 para que el `pgEnum` de la BD no cambie en F04 |
| `IncidentAllowedAction` | `z.enum(['update', 'assign'])`. Acciones que se exponen en `allowedActions`; se llama así para no chocar con el tipo interno `IncidentAction` de la política (que incluye `view`, transiciones…) |
| `AllowedTransition` | `{ to: Status, requiresComment: boolean }`. Se define en F03 para que la forma de `Incident` no cambie en F04; F03 siempre devuelve `[]` |
| `UserSummary` | `{ id, name }` (creador, asignado, candidatos a asignar y, en F04, autor de los eventos) |
| `IncidentTypeSummary` | `{ id, code, name, department: DepartmentSummary }`. Respuesta de `GET /api/incident-types` |
| `IncidentTitle` · `IncidentDescription` · `DueDate` | título (trim, 1–150), descripción (trim, 1–5000) y fecha objetivo `AAAA-MM-DD` (`z.iso.date()`). Constantes `INCIDENT_TITLE_MAX_LENGTH`, `INCIDENT_DESCRIPTION_MAX_LENGTH` |
| `CreateIncidentInput` | `{ title, description, typeId: uuid, priority, dueDate?: DueDate }` |
| `UpdateIncidentInput` | `{ title?, description?, priority?, dueDate?: DueDate \| null }`, con al menos un campo (error en la raíz, como `UpdateUserInput`) |
| `AssignIncidentInput` | `{ assigneeId: uuid }` |
| `IncidentListQuery` | `{ status?, priority?, departmentId?: uuid, assignedToMe?: 'true' \| 'false' → boolean, q?: trim ≤ 100, page?: entero ≥ 1 (por defecto 1) }`, con `z.coerce` porque llega en la *query string*. `INCIDENTS_PAGE_SIZE = 20` |
| `IncidentListItem` | `{ id, code, title, type: { id, code, name }, department: DepartmentSummary, priority, status, assignee: UserSummary \| null, dueDate: string \| null, createdAt: ISO }` |
| `IncidentListResponse` | `{ items: IncidentListItem[], total, page, pageSize }` |
| `Incident` | detalle: `{ id, code, title, description, type, department, priority, status, createdBy: UserSummary, assignee, dueDate, createdAt, updatedAt, resolvedAt: ISO \| null, closedAt: ISO \| null, allowedActions: IncidentAllowedAction[], allowedTransitions: AllowedTransition[] }`. Respuesta del detalle y de todas las mutaciones |

`dueDate` viaja siempre como `AAAA-MM-DD` (fecha sin hora: no se convierte de zona); las marcas de tiempo, como ISO en UTC, y la web las muestra en `Europe/Madrid`.

## API

| Método y ruta | Caso de uso | Permiso (`permisos.md`) | Respuestas |
|---|---|---|---|
| `GET /api/incident-types` | `listIncidentTypes` | con sesión | 200 `IncidentTypeSummary[]` · 401 |
| `GET /api/incidents` | `listIncidents` | ver (solo las visibles) | 200 `IncidentListResponse` · 400 · 401 |
| `POST /api/incidents` | `createIncident` | `createIncident` (global) | 201 `Incident` · 400 · 401 · 403 |
| `GET /api/incidents/:id` | `getIncident` | ver | 200 `Incident` · 401 · 404 |
| `PATCH /api/incidents/:id` | `updateIncident` | editar campos | 200 `Incident` · 400 · 401 · 403 · 404 |
| `GET /api/incidents/:id/assignees` | `listAssignees` | asignar | 200 `UserSummary[]` · 401 · 403 · 404 |
| `POST /api/incidents/:id/assign` | `assignIncident` | asignar ¹ | 200 `Incident` · 400 · 401 · 403 · 404 |

- Todas con `requireSession` (401) y `cache-control: no-store`; las mutaciones exigen `X-Requested-With` (CSRF de F00).
- **Orden de las comprobaciones:** sesión (401) → forma de la *query* o del cuerpo con el esquema de `shared` (400; no depende de la incidencia, así que no revela nada) → `:id` no UUID o inexistente (404) → no visible (404) → acción no permitida (403) → reglas del caso de uso (400 por asignado inválido o tipo inexistente). En `POST /api/incidents` el 403 de Dirección se comprueba en `preValidation`, antes que el cuerpo (como `manageUsers` en F02).
- `:id` que no es un UUID → 404 con el mismo cuerpo que el inexistente y el no visible (CA-03.6): lo resuelve el repositorio, como en F02.
- `typeId` inexistente en el alta → 400 `VALIDATION` con `details` en el campo `typeId` (CA-03.3), sin consumir código.

## Dominio y aplicación

### Dominio (`apps/api/src/domain/incidents/`)
- `incident.ts`: tipos `IncidentStatus` e `IncidentPriority` (uniones de literales que deben coincidir con `Status`/`Priority` de `shared`; lo comprueba un test, como `UserRole`).
- `incident-code.ts`: `incidentYear(date)` (año en `Europe/Madrid` con `Intl`, sin Node) y `formatIncidentCode(year, n)` → `INC-2026-0001`. TDD (31/12 a las 23:30 UTC ya es año nuevo en Madrid).
- `incident-changes.ts`: `diffIncidentFields(before, input)` → `{ field, before, after }[]` de los campos que cambian (para `UPDATED` y el "200 sin evento").

### Autorización (`application/authorization/`, se amplía)
- `incidentVisibilityScope(actor)` → `{ kind: 'all' } | { kind: 'restricted', userId, departmentIds }`. La decide la política (Admin y Dirección: `all`) y el repositorio solo la traduce a SQL. Test: cada incidencia que devuelve el listado cumple `canOnIncident(actor, facts, 'view')` y ninguna de las que faltan lo cumple.
- `canOnIncident`, `incidentActionsFor`, `authorize` y `globalActionsFor` (F02) se reutilizan tal cual.

### Puertos (`application/ports/`)
- `IncidentRepository`: `findById(id)` (con tipo, departamento, creador y asignado; `null` si no existe o el id no es UUID), `list({ scope, filters, page, pageSize })` → `{ items, total }`, `create(data)`, `update(id, changes)` (devuelve la incidencia actualizada).
- `IncidentTypeRepository`: `list()` (por nombre) y `findById(id)`.
- `IncidentCodeCounter`: `next(year)` → número siguiente; atómico dentro de la transacción.
- `IncidentEventWriter`: **solo** `append({ incidentId, type, actorId, data })`. F04 añade la lectura.
- `UserAdminRepository` (F02): se añade `listActiveByDepartment(departmentId)` → `UserSummary[]` por nombre.
- `UnitOfWork`: `TransactionalRepositories` gana `incidents`, `incidentCodes` e `incidentEvents` (mismo patrón que F02).

### Casos de uso (`application/incidents/`)
Reciben el `actor` (`CurrentUser`) y sus dependencias por parámetro; usan `authorize` con los hechos de la incidencia (`IncidentAccessFacts`).

- `incident-presenter.ts`: `presentIncident(actor, incident)` → `Incident` con `allowedActions = incidentActionsFor(...)` filtradas a `IncidentAllowedAction` y `allowedTransitions: []` (F04 lo rellena aquí, en un solo sitio).
- `listIncidentTypes` → con sesión.
- `createIncident(input)` → `globalActionsFor` incluye `createIncident` (403); tipo existente (400); en la `UnitOfWork`: `next(año de Madrid)` → código, `create` con `status OPEN`, `departmentId` del tipo, `createdBy` = actor, y `append(CREATED)`.
- `getIncident(id)` → 404 si no existe o no es visible.
- `listIncidents(query)` → `scope` de la política + filtros (`assignedToMe` usa el id del actor) + página; orden `createdAt` desc y `id` como desempate.
- `updateIncident(id, input)` → 404 / 403 (`update`); *diff*; sin cambios → 200 sin evento; si hay, `update` + `append(UPDATED, { changes })` en la transacción.
- `listAssignees(id)` → 404 / 403 (`assign`); `listActiveByDepartment(departmentId)`.
- `assignIncident(id, { assigneeId })` → 404 / 403 (`assign`); el asignado debe ser activo del dpto. propietario (400 "El usuario no pertenece al departamento de la incidencia o está desactivado."); mismo asignado → 200 sin evento; si no, `update` + `append(ASSIGNED, { from, to })` con `{ id, name }`.

## Base de datos

Migración generada con `npm run db:generate` (no se edita a mano):

- `pgEnum`: `priority`, `incident_status` (los 7 estados), `incident_event_type` (los 4 tipos).
- `incident_types`: `id` uuid, `code` único, `name`, `default_department_id` → `departments`.
- `incidents`: `id` uuid, `code` único, `title` (150), `description` (text), `type_id` → `incident_types`, `department_id` → `departments`, `priority`, `status` (por defecto `OPEN`), `created_by` → `users`, `assigned_to` → `users` (nulo), `due_date` (`date`, nulo), `created_at`, `updated_at`, `resolved_at` y `closed_at` (nulos; los usa F04). Índices: `department_id`, `created_by`, `assigned_to`, `created_at`.
- `code_counters`: `year` (pk), `last_value`. `next(year)` = `INSERT … ON CONFLICT (year) DO UPDATE SET last_value = code_counters.last_value + 1 RETURNING last_value`: bloquea la fila hasta el fin de la transacción, así que dos altas simultáneas no repiten número y un alta que falla no deja hueco (CA-03.4).
- `incident_events`: `id`, `incident_id` → `incidents`, `type`, `actor_id` → `users`, `data` (`jsonb`), `created_at`. Índice (`incident_id`, `created_at`).
- *Seed*: los 7 tipos de `requisitos.md` con su departamento, idempotente por `code` (`TRANSPORT`, `SUPPLIER`, `CUSTOMER`, `QUALITY`, `TECHNICAL`, `ADMINISTRATIVE`, `INTERNAL`; el nombre visible, en español). Sin incidencias demo (F07). En Render, las migraciones y el *seed* ya se ejecutan al arrancar (F00).

## Interfaz (atomic design)

Inventario tras F02: átomos `Badge`, `Button`, `Checkbox`, `Heading`, `Icon`, `Input`, `Label`, `Link`, `Select`, `Spinner`, `Table`, `Text`, `Textarea`; moléculas `Alert`, `CheckboxGroup`, `ConfirmDialog`, `FormField`, `PageHeader`; organismos `AppHeader`, `DemoAccountsPanel`, `LoginForm`, `MainNav`, `UserAccountActions`, `UserForm`, `UserTable`; plantillas `AppLayout`, `AuthLayout`. **Sin dependencias nuevas.**

### Páginas y `app/`

| Página / pieza | Ruta | Plantilla | Acción requerida | Queries / mutaciones |
|---|---|---|---|---|
| `IncidentListPage` | `/incidencias` | `AppLayout` (vía `ProtectedLayout`) | — | `useIncidents(filters, page)`, `useDepartments()` |
| `IncidentCreatePage` | `/incidencias/nueva` | ídem | `RequireAction createIncident` | `useIncidentTypes()`, `useCreateIncident()` |
| `IncidentDetailPage` | `/incidencias/:id` | ídem | — (404 → "Incidencia no encontrada.") | `useIncident(id)`, `useIncidentAssignees(id, { enabled: assign })`, `useAssignIncident(id)` |
| `IncidentEditPage` | `/incidencias/:id/editar` | ídem | `allowedActions` incluye `update` (si no, `ForbiddenPage`) | `useIncident(id)`, `useUpdateIncident(id)` |
| `app/nav-items.ts` | — | — | — | "Incidencias" para todos (entre "Inicio" y "Usuarios") |

- `queries/incidents.ts`: claves `['incidents', 'list', filters, page]` y `['incidents', id]`. Las mutaciones escriben la respuesta en `['incidents', id]` e invalidan `['incidents', 'list']` (y en F04, `['incidents', id, 'events']`). `queries/incident-types.ts`: `useIncidentTypes()` con `staleTime` largo.
- Filtros en el estado de la página (no en la URL); cambiar uno vuelve a la página 1. El buscador espera a que se deje de escribir (~300 ms) para no lanzar una petición por tecla.
- Avisos de éxito por `location.state` (`{ notice: 'Incidencia creada.' }`), como en F02.

### Componentes

| Nivel | Componente | Nuevo / variante / reutilizado | Notas (props, `allowedActions`) |
|---|---|---|---|
| Átomo | `Badge`, `Table`, `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Link`, `Spinner`, `Text`, `Heading` | reutilizados | — |
| Molécula | `FormField`, `Alert`, `PageHeader` | reutilizados | — |
| Molécula | `StatusBadge` | nuevo | `status: Status` → `Badge` con el tono y el texto de `STATUS_LABELS`. F04 lo reutiliza |
| Molécula | `PriorityBadge` | nuevo | `priority: Priority` → `Badge` con `PRIORITY_LABELS` (Urgente = danger, Alta = warning…) |
| Molécula | `Pagination` | nuevo | `page`, `pageSize`, `total`, `onPageChange`, textos por props con valores por defecto ("Anterior", "Siguiente", "*n* resultados"). Botones deshabilitados en los extremos; `nav` con `aria-label` |
| Molécula | `DetailList` | nuevo | `items: { label, value: ReactNode }[]` como `<dl>` en rejilla; lo usa el detalle |
| Organismo | `IncidentFilters` | nuevo | `value: { status?, priority?, departmentId?, assignedToMe, q }`, `departments: DepartmentSummary[]`, `onChange(value)`. Selects con "Todos", casilla "Asignadas a mí" y buscador con `label` |
| Organismo | `IncidentTable` | nuevo | `items: IncidentListItem[]`, `getDetailHref(id)`, `linkAs?`. Columnas de CA-03.12 con `StatusBadge`/`PriorityBadge` y fechas `dd/mm/aaaa`; estado vacío con el texto de la spec |
| Organismo | `IncidentForm` | nuevo | `mode: 'create' \| 'edit'`, `types: IncidentTypeSummary[]` (solo `create`), `defaultValues?`, `onSubmit(values)`, `isSubmitting`, `fieldErrors?`, `errorMessage?`, `cancelHref`, `linkAs?`. Valida con `CreateIncidentInput`/`UpdateIncidentInput`; en `create`, al elegir el tipo muestra "Lo recibirá: <departamento>"; en `edit`, sin tipo y con la fecha objetivo borrable (`null`) |
| Organismo | `IncidentSummary` | nuevo | `incident: Incident`, `actions?: ReactNode` (hueco para "Editar" y, en F04, las transiciones). Cabecera con código, título, `StatusBadge`, `PriorityBadge`; `DetailList` con tipo, departamento, creador, asignado, fechas; descripción con saltos de línea |
| Organismo | `IncidentAssignForm` | nuevo | `assignees: UserSummary[]`, `currentAssigneeId`, `onAssign(assigneeId)`, `isPending`, `notice?`, `errorMessage?`. Select "Asignar a" + botón "Asignar" |
| Plantilla | `AppLayout` | reutilizada | — |

- `lib/labels.ts`: `STATUS_LABELS`, `PRIORITY_LABELS` (con test de que cubren todos los valores del enum).
- `lib/dates.ts` (nuevo): `formatDate('AAAA-MM-DD' | ISO)` → `dd/mm/aaaa` en `Europe/Madrid` y `formatDateTime(ISO)` → `dd/mm/aaaa HH:mm` (lo usa F04). Tests con horas límite (cambio de día en UTC).
- "Nueva incidencia" la pinta la página en `PageHeader.actions` si `CurrentUser.allowedActions` incluye `createIncident`; "Editar" y el formulario de asignación, si `Incident.allowedActions` incluye `update`/`assign`. Los organismos no miran el rol.

## Tests

- **Contrato:** cada esquema con casos válidos, límites (150/5000 caracteres, fecha no válida, `UpdateIncidentInput` vacío), campos del servidor descartados y coerción de la *query*.
- **Dominio:** código y año de Madrid; *diff* de campos.
- **Aplicación (con *fakes*):** cada caso de uso con 404/403/400, evento correcto o ninguno; la transacción revierte el alta si falla el evento (no se consume código).
- **Infraestructura (PGlite):** repositorios, filtros combinados y `scope`, contador sin huecos con altas concurrentes (`Promise.all` de varias altas) y año nuevo, *seed* idempotente de tipos.
- **API (`fastify.inject`):** CA-03.1 a CA-03.10 de punta a punta.
- **Matriz de autorización (CA-03.11, `qa-tester`):** filas nuevas en `authorization-matrix.test.ts` con incidencias de cada relación para el Responsable y el Usuario demo.
- **Web:** stories y tests (axe) de los componentes nuevos; `formatDate`/`formatDateTime`; páginas con `fetch` simulado (filtros, paginación, vacío, error, alta con errores por campo, detalle con y sin acciones, 404, edición, asignación).
- **E2E:** ninguno (F07).

## Riesgos y decisiones

- **F02 no está terminada** (quedan T-02.05 a T-02.08): los componentes de F03 necesitan `Table`, `PageHeader` y `MainNav`, y las páginas, `RequireAction`, `ForbiddenPage` y `nav-items`. F03 empieza la API en cuanto F02 está integrada en su rama; la web, en cuanto lo están T-02.06 y T-02.07.
- **Rama (propuesta para el plazo):** una sola rama `feat/F03-F04-incidencias-estados`, creada desde `main` con F02 ya fusionada (o desde `feat/F02-permisos` si su PR aún no está fusionado), y un solo PR al final de F04 (T-04.06). Es una excepción a "una rama por feature" para que las tareas de F03 y F04 puedan solaparse sin rebases. **Necesita el visto bueno del usuario**; si no lo da, se usan dos ramas apiladas y T-04.06 fusiona los dos PR seguidos.
- **Dos subagentes de backend a la vez** en el mismo árbol se pisan (typecheck, tests, commits) → los `backend-dev` van en serie; `frontend-dev` trabaja en un worktree de `.worktrees/`, y `qa-tester`, en otro si coincide con un `backend-dev`.
- **Concurrencia del código** → contador con `INSERT … ON CONFLICT … RETURNING` dentro de la transacción; se prueba con altas simultáneas en PGlite (que serializa) y la misma consulta vale en Neon.
- **Autorización del listado en SQL** → la decide `incidentVisibilityScope` en la política y un test cruza el resultado con `canOnIncident`; el repositorio no tiene reglas propias.
- **Rendimiento del listado** → índices y página fija de 20; `count(*)` con los mismos filtros.
- **ADR:** ninguno nuevo. Aplican ADR-002 (capas, `UnitOfWork`), ADR-007 (contrato) y ADR-009 (permisos en el servidor).
