# F03 · Incidencias — Tareas

> Fuente de verdad del avance. El hook de inicio de sesión lee este archivo: respeta el formato (`### T-…` y las líneas `- Estado:` y `- Agente:`).
> Estados: `pendiente` · `en curso` · `hecha` · `bloqueada`
>
> **Plazo:** congelación el viernes 27/11/2026 a las 20:00. Orden: T-03.01 → (T-04.01) → T-03.02 ‖ T-03.03 → T-03.04 ‖ T-03.05. El despliegue de F03 se hace junto con el de F04 en **T-04.06**.

### T-03.01 · Ampliar el contrato en `shared` con incidencias y ajustar los requisitos al recorte
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer
- Depende de: T-02.04
- Paralelizable con: T-02.05, T-02.06, T-02.07
- Cubre: CA-03.2 (esquema del alta), CA-03.3 (validación), CA-03.6 (forma del detalle), CA-03.7 (forma del listado), CA-03.8 (esquema de los filtros), CA-03.9 (esquema de la edición), CA-03.10 (esquema de la asignación)
- Archivos: packages/shared/src/{incidents.ts,index.ts} (+ incidents.test.ts), docs/requisitos.md, docs/glosario.md
- Verificación: npm test -w @incidapp/shared && npm run typecheck && npm run lint
- Notas: según la tabla **Contrato** de `plan.md`: `Priority`, `IncidentEventType` (los 4 tipos, también `STATUS_CHANGED`), `IncidentAllowedAction` (`update`, `assign`), `AllowedTransition`, `UserSummary`, `IncidentTypeSummary`, `IncidentTitle`/`IncidentDescription`/`DueDate`, `CreateIncidentInput`, `UpdateIncidentInput` (al menos un campo; `dueDate: null` la quita), `AssignIncidentInput`, `IncidentListQuery` (con coerción de la *query string* y `INCIDENTS_PAGE_SIZE = 20`), `IncidentListItem`, `IncidentListResponse` e `Incident` (con `allowedTransitions` y `resolvedAt`/`closedAt` desde ya, para que F04 no cambie su forma). Mensajes en español; campos del servidor descartados. **Documentación del recorte** (decisión 8 de la spec): en `docs/requisitos.md`, RF-16, RF-17, RF-19 y RF-20 pasan a **W** (fuera del TFM por la fecha de congelación), RF-18 se queda en F01 · F02, RF-11 cita los filtros reducidos, RF-14 dice "con el comentario de un cambio de estado (sin comentarios sueltos)", RF-15 sin adjuntos, y RNF-09/RNF-11 sin F05/F06; HU-02 sin adjuntos. En `docs/glosario.md`: `Priority` ya está; completar **Tipos de evento del historial** con los 4 tipos y cambiar la fila "Comentario" a "campo `comment` de un evento `STATUS_CHANGED`".

### T-03.02 · Implementar las incidencias en la API: tipos, alta con código, listado, detalle, edición y asignación
- Estado: hecha
- Agente: backend-dev · Revisores: code-reviewer, security-reviewer
- Depende de: T-03.01
- Paralelizable con: T-03.03, T-04.03
- Cubre: CA-03.1, CA-03.2, CA-03.3, CA-03.4, CA-03.5, CA-03.6, CA-03.7, CA-03.8, CA-03.9, CA-03.10
- Archivos: apps/api/src/domain/incidents/{incident.ts,incident-code.ts,incident-changes.ts} (+ tests), apps/api/src/application/authorization/authorization-policy.ts (`incidentVisibilityScope`, + test), apps/api/src/application/ports/{incident-repository.ts,incident-type-repository.ts,incident-code-counter.ts,incident-event-writer.ts,user-admin-repository.ts,unit-of-work.ts}, apps/api/src/application/incidents/… (+ tests y test-fakes), apps/api/src/infrastructure/db/{schema.ts,seed.ts,unit-of-work.ts,repositories/{incident-repository,incident-type-repository,incident-code-counter,incident-event-writer,user-admin-repository}.ts} (+ tests), apps/api/drizzle/ (migración generada), apps/api/src/http/routes/{incidents.ts,incident-types.ts} (+ tests), apps/api/src/http/{app.ts,test-support.ts}, apps/api/src/composition/container.ts
- Verificación: npm run db:generate (sin cambios pendientes tras generar) && npm test -w @incidapp/api && npm run typecheck && npm run lint
- Notas: skill `caso-de-uso`. TDD en dominio y casos de uso. Endpoints, orden de las comprobaciones y mensajes según `plan.md` (forma 400 → 404 → 403 → reglas 400; 403 de Dirección en el alta en `preValidation`; `:id` no UUID → 404 igual que el inexistente y el no visible). Reutiliza `UnitOfWork` (amplía `TransactionalRepositories`), `authorize`, `canOnIncident`, `incidentActionsFor` y `globalActionsFor`: ningún `role ===` fuera de `application/authorization/`. La visibilidad del listado la decide `incidentVisibilityScope` (política) y el repositorio solo la traduce a SQL. `presentIncident` es el único sitio que construye `Incident` (`allowedActions` filtradas a `IncidentAllowedAction`, `allowedTransitions: []`). Contador con `INSERT … ON CONFLICT … RETURNING` en la transacción: test con altas simultáneas sin repetidos ni huecos, alta fallida que no consume número y primer alta de año nuevo con reloj inyectado. `incident_events` con un puerto **solo de inserción** (`append`). *Seed* idempotente de los 7 tipos. Añade a `unusedAdmin` (o a un `unusedIncidents` nuevo) de `test-support.ts` los casos de uso nuevos para que los tests existentes de `http/` sigan montando la app. `cache-control: no-store`.

### T-03.03 · Crear los componentes de incidencias: badges, paginación, filtros, tabla, formulario, resumen y asignación
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-03.01, T-02.06
- Paralelizable con: T-03.02, T-04.01
- Cubre: CA-03.12 (tabla, filtros, paginación, vacío), CA-03.13 (formulario de alta), CA-03.14 (resumen del detalle), CA-03.15 (formulario de edición y asignación)
- Archivos: apps/web/src/components/molecules/{StatusBadge,PriorityBadge,Pagination,DetailList}/…, apps/web/src/components/organisms/{IncidentFilters,IncidentTable,IncidentForm,IncidentSummary,IncidentAssignForm}/…, índices de nivel, apps/web/src/lib/{labels.ts,dates.ts} (+ tests)
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build-storybook
- Notas: skill `componente`, en un worktree de `.worktrees/` (receta en la skill `tarea`). Presentacionales (sin queries, router ni sesión); props según `plan.md`. Reutiliza `Badge`, `Table`, `FormField`, `PageHeader`, `Alert` y el patrón de `UserForm`/`UserTable` de F02 (validación con el esquema de `shared`, `fieldErrors` del servidor, `linkAs`). `IncidentForm` valida con `CreateIncidentInput`/`UpdateIncidentInput`, muestra el departamento del tipo elegido y en `edit` no tiene tipo. `IncidentSummary` deja un hueco `actions` que llenarán "Editar" y las transiciones de F04. `formatDate` no desplaza las fechas `AAAA-MM-DD`; `formatDateTime` (para F04) en `Europe/Madrid`. Stories con los estados (vacío, cargando por props, errores, enviando, con y sin acciones, sin asignado) y tests de interacción; axe sin violaciones.

### T-03.04 · Montar las páginas de incidencias: listado, alta, detalle y edición
- Estado: pendiente
- Agente: frontend-dev · Revisores: code-reviewer
- Depende de: T-03.02, T-03.03, T-02.07
- Paralelizable con: T-03.05, T-04.02
- Cubre: CA-03.12, CA-03.13, CA-03.14, CA-03.15
- Archivos: apps/web/src/queries/{incidents.ts,incident-types.ts} (+ tests), apps/web/src/app/{router.tsx,nav-items.ts,paths.ts} (+ tests), apps/web/src/pages/{IncidentListPage,IncidentCreatePage,IncidentDetailPage,IncidentEditPage}/…
- Verificación: npm run lint && npm test -w @incidapp/web && npm run build && prueba manual con `npm run dev` (como Usuario: crear una incidencia, verla en el listado, filtrarla y editarla; como Responsable de su dpto.: asignarla; como Dirección: sin "Nueva incidencia" ni "Editar"; una URL con id inexistente muestra "Incidencia no encontrada.")
- Notas: skill `componente` para las páginas. Rutas, queries y claves de caché según `plan.md`. "Incidencias" en `navItemsFor` para todos; `/incidencias/nueva` con `RequireAction createIncident`. Las acciones del detalle salen solo de `Incident.allowedActions` (la web no mira el rol). Filtros en el estado de la página, vuelta a la página 1 al cambiarlos y buscador con espera (~300 ms). Errores de la API en español sin perder lo escrito (400 → `fieldErrors`). Avisos de éxito por `location.state`. Tests de páginas con `fetch` simulado. **Punto de control:** la revisión de la UI de F03 en el navegador por el usuario se hace junto con la de F04 (T-04.04), salvo que la pida antes.

### T-03.05 · Ampliar la matriz de autorización con los endpoints de incidencias
- Estado: pendiente
- Agente: qa-tester · Revisores: code-reviewer
- Depende de: T-03.02
- Paralelizable con: T-03.04, T-04.02
- Cubre: CA-03.11
- Archivos: apps/api/src/http/authorization-matrix.test.ts, apps/api/src/http/test-support.ts (ayudas para crear incidencias de cada relación)
- Verificación: npm test -w @incidapp/api -- authorization-matrix && npm run lint
- Notas: reutiliza `createAuthzClient` y la tabla `it.each` de CA-02.15. El montaje de la app con infraestructura real va en el propio `*.test.ts` (la regla de capas no deja a `http/` importar `infrastructure/` fuera de los tests); `test-support.ts` solo recibe ayudas sin infraestructura. Incidencias de cada relación para el Responsable y el Usuario demo (de sus dptos. · creada por él · asignada a él · ninguna) creadas por la API con el Admin; filas `{ método, endpoint, relación, sin sesión, ADMIN, DIRECTOR, MANAGER, USER }` para los 7 endpoints de F03 con cuerpos válidos, incluida la nota ² (Responsable fuera de sus dptos. con una creada) y "el Usuario no edita fuera de `OPEN`" (se cambia el estado directamente en la BD del test). Comprueba también que el listado no incluye ninguna incidencia no visible. Si coincide en el tiempo con un `backend-dev`, en un worktree de `.worktrees/`. No toca código de producción.

---

## Cobertura

| Criterio | Tareas |
|---|---|
| CA-03.1 | T-03.02, T-04.06 (en producción) |
| CA-03.2 | T-03.01 (esquema), T-03.02 |
| CA-03.3 | T-03.01 (esquema), T-03.02 |
| CA-03.4 | T-03.02, T-04.06 (en producción) |
| CA-03.5 | T-03.02, T-03.05 |
| CA-03.6 | T-03.01 (forma), T-03.02, T-03.05 |
| CA-03.7 | T-03.01 (forma), T-03.02, T-03.05 |
| CA-03.8 | T-03.01 (esquema), T-03.02 |
| CA-03.9 | T-03.01 (esquema), T-03.02, T-03.05 |
| CA-03.10 | T-03.01 (esquema), T-03.02, T-03.05 |
| CA-03.11 | T-03.05 |
| CA-03.12 | T-03.03, T-03.04 |
| CA-03.13 | T-03.03, T-03.04 |
| CA-03.14 | T-03.03, T-03.04 |
| CA-03.15 | T-03.03, T-03.04 |
